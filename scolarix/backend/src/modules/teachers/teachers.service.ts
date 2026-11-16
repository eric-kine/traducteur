import type { Prisma, Teacher } from '@prisma/client';
import type { z } from 'zod';
import { computePaidHours, round2, type Unavailability, type createTeacherSchema, type listTeachersQuerySchema, type TeacherServiceSummary, type updateTeacherSchema } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { assertNoDependents } from '../../common/utils/dependents';
import { nextEmployeeNumber } from '../../common/utils/counter';

export const toDto = (t: Teacher) => ({
  id: t.id,
  employeeNumber: t.employeeNumber,
  title: t.title,
  firstName: t.firstName,
  lastName: t.lastName,
  grade: t.grade,
  specialtyField: t.specialtyField,
  email: t.email,
  phone: t.phone,
  status: t.status,
  hourlyRate: t.hourlyRate ? t.hourlyRate.toNumber() : null,
  isActive: t.isActive,
  unavailability: (t.unavailability as Unavailability | null) ?? [],
  createdAt: t.createdAt.toISOString(),
});

async function assertEmailFree(email: string, exceptId?: string) {
  const other = await prisma.teacher.findUnique({ where: { email }, select: { id: true } });
  if (other && other.id !== exceptId) {
    throw new AppError(409, 'CONFLICT', 'Email déjà utilisé', { email: ['Un enseignant utilise déjà cet email'] });
  }
}

export async function list(q: z.output<typeof listTeachersQuerySchema>) {
  const where: Prisma.TeacherWhereInput = {
    ...(q.status && { status: q.status }),
    ...(q.isActive !== undefined && { isActive: q.isActive }),
    ...(q.search && {
      OR: [
        { lastName: { contains: q.search, mode: 'insensitive' } },
        { firstName: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
        { employeeNumber: { contains: q.search, mode: 'insensitive' } },
        { specialtyField: { contains: q.search, mode: 'insensitive' } },
      ],
    }),
  };
  return (await prisma.teacher.findMany({ where, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] })).map(toDto);
}

export async function findOrFail(id: string) {
  const t = await prisma.teacher.findUnique({ where: { id } });
  if (!t) throw AppError.notFound('Enseignant introuvable');
  return t;
}

export async function create(data: z.output<typeof createTeacherSchema>) {
  await assertEmailFree(data.email);
  return toDto(await prisma.$transaction(async (tx) => tx.teacher.create({ data: { ...data, employeeNumber: await nextEmployeeNumber(tx) } })));
}

export async function update(id: string, data: z.output<typeof updateTeacherSchema>) {
  await findOrFail(id);
  if (data.email) await assertEmailFree(data.email, id);
  return toDto(await prisma.teacher.update({ where: { id }, data }));
}

export async function remove(id: string) {
  await findOrFail(id);
  const { _count } = await prisma.teacher.findUniqueOrThrow({
    where: { id },
    select: { _count: { select: { assignments: true, sessions: true } } },
  });
  assertNoDependents(_count, { assignments: 'affectation(s)', sessions: 'séance(s) d’emploi du temps' });
  await prisma.teacher.delete({ where: { id } });
}

/**
 * Service d'un enseignant pour une année : heures prévues / assurées par type,
 * équivalent TD des heures assurées et montant dû (× son taux horaire).
 */
export async function serviceSummary(id: string, academicYearId: string): Promise<TeacherServiceSummary> {
  const teacher = await findOrFail(id);
  const rows = await prisma.teachingAssignment.groupBy({
    by: ['sessionType'],
    where: { teacherId: id, academicYearId },
    _sum: { assignedHours: true, completedHours: true },
  });
  const pick = (type: 'CM' | 'TD' | 'TP', f: 'assignedHours' | 'completedHours') =>
    rows.find((r) => r.sessionType === type)?._sum[f]?.toNumber() ?? 0;
  const assigned = { CM: pick('CM', 'assignedHours'), TD: pick('TD', 'assignedHours'), TP: pick('TP', 'assignedHours') };
  const completed = { CM: pick('CM', 'completedHours'), TD: pick('TD', 'completedHours'), TP: pick('TP', 'completedHours') };
  const completedTdEquivalent = computePaidHours({ cmHours: completed.CM, tdHours: completed.TD, tpHours: completed.TP });
  const hourlyRate = teacher.hourlyRate ? teacher.hourlyRate.toNumber() : null;
  return {
    assigned,
    completed,
    assignedTotal: round2(assigned.CM + assigned.TD + assigned.TP),
    completedTotal: round2(completed.CM + completed.TD + completed.TP),
    completedTdEquivalent,
    hourlyRate,
    amountDue: hourlyRate === null ? null : round2(completedTdEquivalent * hourlyRate),
  };
}
