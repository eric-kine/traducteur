import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { createEnrollmentSchema, listEnrollmentsQuerySchema, updateEnrollmentSchema } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { assertNoDependents } from '../../common/utils/dependents';
import type { AuthUser } from '../../common/types';
import { assertCanManageSchool, assertSchoolAccess, getSchoolScope } from '../../common/middlewares/school-scope';

type Db = Prisma.TransactionClient | typeof prisma;

export const enrollmentInclude = {
  academicYear: { select: { id: true, label: true } },
  level: { select: { id: true, code: true, name: true } },
  specialty: { select: { id: true, code: true, name: true } },
} as const;

const withStudent = {
  ...enrollmentInclude,
  student: { select: { id: true, matricule: true, firstName: true, lastName: true, schoolId: true } },
} as const;

type EnrollmentRow = Prisma.EnrollmentGetPayload<{ include: typeof enrollmentInclude }> & {
  student?: { id: string; matricule: string; firstName: string; lastName: string };
};

export const toDto = (e: EnrollmentRow) => ({
  id: e.id,
  studentId: e.studentId,
  status: e.status,
  isRepeating: e.isRepeating,
  enrolledAt: e.enrolledAt.toISOString(),
  academicYear: e.academicYear,
  level: e.level,
  specialty: e.specialty,
  ...(e.student && {
    student: { id: e.student.id, matricule: e.student.matricule, firstName: e.student.firstName, lastName: e.student.lastName },
  }),
});

/**
 * Règles d'une inscription : l'année existe, le niveau et la spécialité
 * appartiennent à l'école de l'étudiant.
 */
export async function assertEnrollmentTargets(
  schoolId: string,
  t: { academicYearId?: string; levelId?: string; specialtyId?: string | null },
  db: Db = prisma,
) {
  const errors: Record<string, string[]> = {};
  if (t.academicYearId && !(await db.academicYear.findUnique({ where: { id: t.academicYearId }, select: { id: true } }))) {
    errors.academicYearId = ['Année académique introuvable'];
  }
  if (t.levelId) {
    const level = await db.level.findUnique({ where: { id: t.levelId }, select: { schoolId: true } });
    if (!level || level.schoolId !== schoolId) errors.levelId = ["Ce niveau n'appartient pas à l'école de l'étudiant"];
  }
  if (t.specialtyId) {
    const sp = await db.specialty.findUnique({ where: { id: t.specialtyId }, select: { schoolId: true } });
    if (!sp || sp.schoolId !== schoolId) errors.specialtyId = ["Cette spécialité n'appartient pas à l'école de l'étudiant"];
  }
  if (Object.keys(errors).length) throw AppError.badRequest('Inscription invalide', errors);
}

const alreadyEnrolled = () =>
  new AppError(409, 'CONFLICT', 'Cet étudiant est déjà inscrit pour cette année', {
    academicYearId: ['Déjà inscrit pour cette année : modifiez l’inscription existante'],
  });

export async function list(user: AuthUser, q: z.output<typeof listEnrollmentsQuerySchema>) {
  const scope = getSchoolScope(user);
  const schoolId = scope ?? q.schoolId;
  if (scope && q.schoolId && q.schoolId !== scope) throw AppError.forbidden();
  const where: Prisma.EnrollmentWhereInput = {
    ...(q.academicYearId && { academicYearId: q.academicYearId }),
    ...(q.levelId && { levelId: q.levelId }),
    ...(q.specialtyId && { specialtyId: q.specialtyId }),
    ...(q.studentId && { studentId: q.studentId }),
    ...(q.status && { status: q.status }),
    ...(schoolId && { student: { schoolId } }),
  };
  const rows = await prisma.enrollment.findMany({
    where,
    include: withStudent,
    orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
  });
  return rows.map(toDto);
}

export async function create(user: AuthUser, data: z.output<typeof createEnrollmentSchema>) {
  const student = await prisma.student.findUnique({ where: { id: data.studentId }, select: { schoolId: true } });
  if (!student) throw AppError.notFound('Étudiant introuvable');
  assertCanManageSchool(user, student.schoolId);
  await assertEnrollmentTargets(student.schoolId, data);
  const exists = await prisma.enrollment.findUnique({
    where: { studentId_academicYearId: { studentId: data.studentId, academicYearId: data.academicYearId } },
  });
  if (exists) throw alreadyEnrolled();
  return toDto(await prisma.enrollment.create({ data: { ...data, specialtyId: data.specialtyId ?? null }, include: withStudent }));
}

async function findOrFail(id: string) {
  const e = await prisma.enrollment.findUnique({ where: { id }, include: withStudent });
  if (!e) throw AppError.notFound('Inscription introuvable');
  return e;
}

export async function update(user: AuthUser, id: string, data: z.output<typeof updateEnrollmentSchema>) {
  const current = await findOrFail(id);
  assertCanManageSchool(user, current.student.schoolId);
  await assertEnrollmentTargets(current.student.schoolId, data);
  return toDto(await prisma.enrollment.update({ where: { id }, data, include: withStudent }));
}

export async function remove(user: AuthUser, id: string) {
  const current = await findOrFail(id);
  assertCanManageSchool(user, current.student.schoolId);
  const { _count } = await prisma.enrollment.findUniqueOrThrow({
    where: { id },
    select: { _count: { select: { grades: true, documents: true } } },
  });
  assertNoDependents(_count, { grades: 'note(s)', documents: 'document(s) émis' });
  await prisma.enrollment.delete({ where: { id } });
}

export async function getForStudent(user: AuthUser, studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
  if (!student) throw AppError.notFound('Étudiant introuvable');
  assertSchoolAccess(user, student.schoolId);
  const rows = await prisma.enrollment.findMany({
    where: { studentId },
    include: enrollmentInclude,
    orderBy: { academicYear: { startDate: 'desc' } },
  });
  return rows.map(toDto);
}
