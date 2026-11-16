import type { Prisma, SessionType } from '@prisma/client';
import type { z } from 'zod';
import { round2, type CoverageDto, type createAssignmentSchema, type listAssignmentsQuerySchema, type updateAssignmentSchema } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import type { AuthUser } from '../../common/types';
import { assertCanManageSchool, assertSchoolAccess, getSchoolScope } from '../../common/middlewares/school-scope';

type Db = Prisma.TransactionClient | typeof prisma;

const include = {
  academicYear: { select: { id: true, label: true } },
  teacher: { select: { id: true, employeeNumber: true, title: true, firstName: true, lastName: true, hourlyRate: true } },
  teachingUnit: {
    select: {
      id: true, code: true, title: true, semester: true,
      level: { select: { id: true, code: true, name: true, school: { select: { id: true, code: true, name: true } } } },
    },
  },
} as const;
type Row = Prisma.TeachingAssignmentGetPayload<{ include: typeof include }>;

const toDto = (a: Row) => ({
  id: a.id,
  sessionType: a.sessionType,
  assignedHours: a.assignedHours.toNumber(),
  completedHours: a.completedHours.toNumber(),
  isCoordinator: a.isCoordinator,
  academicYear: a.academicYear,
  teacher: { ...a.teacher, hourlyRate: a.teacher.hourlyRate?.toNumber() ?? null },
  teachingUnit: a.teachingUnit,
});

const QUOTA_FIELD = { CM: 'cmHours', TD: 'tdHours', TP: 'tpHours' } as const;
const TYPE_LABEL = { CM: 'CM', TD: 'TD', TP: 'TP' } as const;

async function getUnit(teachingUnitId: string, db: Db = prisma) {
  const unit = await db.teachingUnit.findUnique({
    where: { id: teachingUnitId },
    select: { id: true, code: true, cmHours: true, tdHours: true, tpHours: true, level: { select: { schoolId: true } } },
  });
  if (!unit) throw AppError.badRequest('UE introuvable', { teachingUnitId: ['UE introuvable'] });
  return unit;
}

/** Couverture d'une UE : pour chaque type, quota, heures affectées, assurées et reste à affecter. */
export async function coverage(user: AuthUser, teachingUnitId: string, academicYearId: string): Promise<CoverageDto> {
  const unit = await getUnit(teachingUnitId);
  assertSchoolAccess(user, unit.level.schoolId);
  const sums = await prisma.teachingAssignment.groupBy({
    by: ['sessionType'],
    where: { teachingUnitId, academicYearId },
    _sum: { assignedHours: true, completedHours: true },
  });
  const byType = Object.fromEntries(
    (['CM', 'TD', 'TP'] as const).map((t) => {
      const quota = unit[QUOTA_FIELD[t]].toNumber();
      const s = sums.find((x) => x.sessionType === t)?._sum;
      const assigned = s?.assignedHours?.toNumber() ?? 0;
      return [t, { quota, assigned, completed: s?.completedHours?.toNumber() ?? 0, remaining: round2(quota - assigned) }];
    }),
  ) as CoverageDto['byType'];
  return { teachingUnitId, academicYearId, byType };
}

/**
 * Règle principale : la somme des heures affectées sur une UE, pour un type
 * (CM/TD/TP) et une année, ne dépasse pas le quota de l'UE pour ce type.
 */
async function assertWithinQuota(
  db: Db,
  unit: Awaited<ReturnType<typeof getUnit>>,
  academicYearId: string,
  type: SessionType,
  hours: number,
  exceptId?: string,
) {
  // Verrouille la ligne de l'UE jusqu'à la fin de la transaction : deux affectations
  // simultanées sont vérifiées l'une après l'autre (pas de dépassement possible).
  await db.$executeRaw`SELECT 1 FROM "teaching_units" WHERE "id" = ${unit.id} FOR UPDATE`;
  const quota = unit[QUOTA_FIELD[type]].toNumber();
  const agg = await db.teachingAssignment.aggregate({
    where: { teachingUnitId: unit.id, academicYearId, sessionType: type, ...(exceptId && { id: { not: exceptId } }) },
    _sum: { assignedHours: true },
  });
  const others = agg._sum.assignedHours?.toNumber() ?? 0;
  const remaining = round2(quota - others);
  if (round2(others + hours) > quota) {
    const msg =
      quota === 0
        ? `L'UE ${unit.code} n'a pas d'heures de ${TYPE_LABEL[type]}`
        : `Dépasse le quota ${TYPE_LABEL[type]} de ${unit.code} : ${quota} h au total, ${remaining} h encore disponibles`;
    throw AppError.badRequest(msg, { assignedHours: [msg] });
  }
}

const assertCompletedOk = (assigned: number, completed: number) => {
  if (completed > assigned) {
    throw AppError.badRequest('Heures assurées > heures prévues', {
      completedHours: ['Les heures assurées ne peuvent pas dépasser les heures prévues'],
    });
  }
};

/** Un seul responsable (coordinateur) par UE et par année. */
async function clearOtherCoordinators(db: Db, teachingUnitId: string, academicYearId: string, exceptId: string) {
  await db.teachingAssignment.updateMany({
    where: { teachingUnitId, academicYearId, id: { not: exceptId }, isCoordinator: true },
    data: { isCoordinator: false },
  });
}

export async function list(user: AuthUser, q: z.output<typeof listAssignmentsQuerySchema>) {
  const scope = getSchoolScope(user);
  if (scope && q.schoolId && q.schoolId !== scope) throw AppError.forbidden();
  const schoolId = scope ?? q.schoolId;
  const rows = await prisma.teachingAssignment.findMany({
    where: {
      ...(q.academicYearId && { academicYearId: q.academicYearId }),
      ...(q.teacherId && { teacherId: q.teacherId }),
      ...(q.teachingUnitId && { teachingUnitId: q.teachingUnitId }),
      ...((q.levelId || schoolId) && {
        teachingUnit: { ...(q.levelId && { levelId: q.levelId }), ...(schoolId && { level: { schoolId } }) },
      }),
    },
    include,
    orderBy: [{ teachingUnit: { code: 'asc' } }, { sessionType: 'asc' }],
  });
  return rows.map(toDto);
}

export async function create(user: AuthUser, data: z.output<typeof createAssignmentSchema>) {
  const unit = await getUnit(data.teachingUnitId);
  assertCanManageSchool(user, unit.level.schoolId);
  const teacher = await prisma.teacher.findUnique({ where: { id: data.teacherId }, select: { isActive: true } });
  if (!teacher) throw AppError.badRequest('Enseignant introuvable', { teacherId: ['Enseignant introuvable'] });
  if (!teacher.isActive) throw AppError.badRequest('Enseignant inactif', { teacherId: ['Cet enseignant est désactivé'] });
  if (!(await prisma.academicYear.findUnique({ where: { id: data.academicYearId } }))) {
    throw AppError.badRequest('Année introuvable', { academicYearId: ['Année académique introuvable'] });
  }
  assertCompletedOk(data.assignedHours, data.completedHours);
  const dup = await prisma.teachingAssignment.findUnique({
    where: {
      teacherId_teachingUnitId_academicYearId_sessionType: {
        teacherId: data.teacherId, teachingUnitId: data.teachingUnitId, academicYearId: data.academicYearId, sessionType: data.sessionType,
      },
    },
  });
  if (dup) {
    throw new AppError(409, 'CONFLICT', 'Affectation déjà existante', {
      sessionType: [`Cet enseignant a déjà les ${data.sessionType} de cette UE : modifiez ses heures`],
    });
  }

  return toDto(
    await prisma.$transaction(async (tx) => {
      await assertWithinQuota(tx, unit, data.academicYearId, data.sessionType, data.assignedHours);
      const a = await tx.teachingAssignment.create({ data, include });
      if (data.isCoordinator) await clearOtherCoordinators(tx, a.teachingUnitId, a.academicYearId, a.id);
      return a;
    }),
  );
}

async function findOrFail(id: string) {
  const a = await prisma.teachingAssignment.findUnique({ where: { id }, include });
  if (!a) throw AppError.notFound('Affectation introuvable');
  return a;
}

export async function update(user: AuthUser, id: string, data: z.output<typeof updateAssignmentSchema>) {
  const current = await findOrFail(id);
  assertCanManageSchool(user, current.teachingUnit.level.school.id);
  const assigned = data.assignedHours ?? current.assignedHours.toNumber();
  const completed = data.completedHours ?? current.completedHours.toNumber();
  assertCompletedOk(assigned, completed);
  return toDto(
    await prisma.$transaction(async (tx) => {
      if (data.assignedHours !== undefined) {
        await assertWithinQuota(tx, await getUnit(current.teachingUnit.id, tx), current.academicYear.id, current.sessionType, assigned, id);
      }
      const a = await tx.teachingAssignment.update({ where: { id }, data, include });
      if (data.isCoordinator) await clearOtherCoordinators(tx, a.teachingUnitId, a.academicYearId, a.id);
      return a;
    }),
  );
}

export async function remove(user: AuthUser, id: string) {
  const current = await findOrFail(id);
  assertCanManageSchool(user, current.teachingUnit.level.school.id);
  await prisma.teachingAssignment.delete({ where: { id } });
}
