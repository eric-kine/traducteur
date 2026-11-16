import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  computeRetakeFinal, computeUeFinal, GRADING_RULES,
  type GradeSheet, type GradeSheetRow, type saveGradeSheetSchema,
} from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import type { AuthUser } from '../../common/types';
import { assertSchoolAccess } from '../../common/middlewares/school-scope';

type Session = 'NORMALE' | 'RATTRAPAGE';
const n = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());

async function getUnit(id: string) {
  const u = await prisma.teachingUnit.findUnique({
    where: { id },
    include: { level: { select: { id: true, schoolId: true } } },
  });
  if (!u) throw AppError.notFound('UE introuvable');
  return u;
}

/**
 * Droit de saisir les notes d'une UE pour une année :
 *  - ADMIN ; SCOLARITE de l'école ;
 *  - ENSEIGNANT affecté à cette UE pour cette année (compte relié à sa fiche enseignant).
 */
async function canEdit(user: AuthUser, unit: { id: string; level: { schoolId: string } }, academicYearId: string) {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'SCOLARITE') return user.schoolId === null || user.schoolId === unit.level.schoolId;
  if (user.role === 'ENSEIGNANT') {
    const a = await prisma.teachingAssignment.findFirst({
      where: { teachingUnitId: unit.id, academicYearId, teacher: { userId: user.id } },
      select: { id: true },
    });
    return !!a;
  }
  return false;
}

async function assertCanRead(user: AuthUser, unit: Awaited<ReturnType<typeof getUnit>>, academicYearId: string) {
  if (user.role === 'ENSEIGNANT') {
    if (!(await canEdit(user, unit, academicYearId))) throw AppError.forbidden("Vous n'êtes pas affecté à cette UE");
    return;
  }
  if (user.role === 'ETUDIANT') throw AppError.forbidden();
  assertSchoolAccess(user, unit.level.schoolId);
}

/** Inscriptions concernées par une UE : même niveau et année, spécialité compatible, non annulées. */
function enrollmentsWhere(unit: { levelId: string; specialtyId: string | null }, academicYearId: string): Prisma.EnrollmentWhereInput {
  return {
    levelId: unit.levelId,
    academicYearId,
    status: { not: 'ANNULE' },
    ...(unit.specialtyId && { specialtyId: unit.specialtyId }),
  };
}

export async function getSheet(user: AuthUser, unitId: string, academicYearId: string, session: Session): Promise<GradeSheet> {
  const unit = await getUnit(unitId);
  await assertCanRead(user, unit, academicYearId);
  const year = await prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { id: true, label: true } });
  if (!year) throw AppError.notFound('Année académique introuvable');

  const enrollments = await prisma.enrollment.findMany({
    where: enrollmentsWhere(unit, academicYearId),
    include: {
      student: { select: { id: true, matricule: true, firstName: true, lastName: true } },
      specialty: { select: { code: true } },
      grades: { where: { teachingUnitId: unitId } },
    },
    orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
  });

  const w = { ccWeight: unit.ccWeight, examWeight: unit.examWeight, tpWeight: unit.tpWeight };
  const rows: GradeSheetRow[] = [];
  let locked = false;
  for (const e of enrollments) {
    const normal = e.grades.find((g) => g.session === 'NORMALE') ?? null;
    const own = e.grades.find((g) => g.session === session) ?? null;
    if (e.deliberatedAt || e.grades.some((g) => g.isLocked)) locked = true;
    const normalScores = normal && { ccScore: n(normal.ccScore), examScore: n(normal.examScore), tpScore: n(normal.tpScore), isAbsent: normal.isAbsent };
    const normalFinal = normalScores ? computeUeFinal(w, normalScores) : null;
    // Rattrapage : seuls les étudiants sans note suffisante en session normale
    if (session === 'RATTRAPAGE' && normalFinal !== null && normalFinal >= GRADING_RULES.passMark && !own) continue;
    rows.push({
      enrollmentId: e.id,
      student: e.student,
      specialty: e.specialty?.code ?? null,
      ccScore: own ? n(own.ccScore) : null,
      examScore: own ? n(own.examScore) : null,
      tpScore: own ? n(own.tpScore) : null,
      isAbsent: own?.isAbsent ?? false,
      comment: own?.comment ?? null,
      finalScore: own ? n(own.finalScore) : null,
      ...(session === 'RATTRAPAGE' && { normal: normalScores ? { ...normalScores, finalScore: normalFinal } : null }),
    });
  }
  return {
    teachingUnit: {
      id: unit.id, code: unit.code, title: unit.title, semester: unit.semester, credits: unit.credits,
      coefficient: unit.coefficient.toNumber(), ...w, levelId: unit.levelId,
    },
    academicYear: year,
    session,
    locked,
    canEdit: !locked && (await canEdit(user, unit, academicYearId)),
    rows,
  };
}

/**
 * Enregistre une feuille de notes. La note finale est TOUJOURS recalculée
 * par le serveur à partir des composantes et des pondérations de l'UE.
 */
export async function saveSheet(user: AuthUser, unitId: string, data: z.output<typeof saveGradeSheetSchema>) {
  const unit = await getUnit(unitId);
  if (!(await canEdit(user, unit, data.academicYearId))) throw AppError.forbidden('Vous ne pouvez pas saisir les notes de cette UE');

  const enrollments = await prisma.enrollment.findMany({
    where: { ...enrollmentsWhere(unit, data.academicYearId), id: { in: data.grades.map((g) => g.enrollmentId) } },
    include: { grades: { where: { teachingUnitId: unitId } } },
  });
  const byId = new Map(enrollments.map((e) => [e.id, e]));
  const unknown = data.grades.filter((g) => !byId.has(g.enrollmentId));
  if (unknown.length) throw AppError.badRequest(`${unknown.length} inscription(s) ne concernent pas cette UE`);
  if (enrollments.some((e) => e.deliberatedAt || e.grades.some((g) => g.isLocked))) {
    throw new AppError(409, 'LOCKED', 'Les notes sont verrouillées : la délibération a eu lieu');
  }

  const w = { ccWeight: unit.ccWeight, examWeight: unit.examWeight, tpWeight: unit.tpWeight };
  await prisma.$transaction(
    data.grades.map((g) => {
      const e = byId.get(g.enrollmentId)!;
      const scores = { ccScore: g.ccScore ?? null, examScore: g.examScore ?? null, tpScore: g.tpScore ?? null, isAbsent: g.isAbsent };
      let finalScore: number | null;
      if (data.session === 'NORMALE') {
        finalScore = computeUeFinal(w, scores);
      } else {
        const normal = e.grades.find((x) => x.session === 'NORMALE');
        scores.ccScore = null; // en rattrapage, le CC n'est pas ressaisi
        finalScore = computeRetakeFinal(
          w,
          normal ? { ccScore: n(normal.ccScore), examScore: n(normal.examScore), tpScore: n(normal.tpScore), isAbsent: normal.isAbsent } : null,
          scores,
        );
      }
      const values = {
        ...scores,
        finalScore,
        isValidated: finalScore !== null && finalScore >= GRADING_RULES.passMark,
        comment: g.comment ?? null,
        enteredByUserId: user.id,
      };
      return prisma.grade.upsert({
        where: { enrollmentId_teachingUnitId_session: { enrollmentId: g.enrollmentId, teachingUnitId: unitId, session: data.session } },
        create: { ...values, enrollmentId: g.enrollmentId, teachingUnitId: unitId, session: data.session },
        update: values,
      });
    }),
  );
  return getSheet(user, unitId, data.academicYearId, data.session);
}
