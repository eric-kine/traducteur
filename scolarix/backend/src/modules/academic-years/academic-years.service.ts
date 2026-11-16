import type { AcademicYear } from '@prisma/client';
import type { z } from 'zod';
import type { createAcademicYearSchema, updateAcademicYearSchema } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { assertNoDependents } from '../../common/utils/dependents';
import { fromDate, toDate } from '../../common/utils/dates';
import * as institute from '../institute/institute.service';

type CreateData = z.output<typeof createAcademicYearSchema>;
type UpdateData = z.output<typeof updateAcademicYearSchema>;

const counts = { _count: { select: { enrollments: true, assignments: true } } } as const;

export const toDto = (y: AcademicYear & { _count?: { enrollments: number; assignments: number } }) => ({
  id: y.id,
  label: y.label,
  startDate: fromDate(y.startDate),
  endDate: fromDate(y.endDate),
  isCurrent: y.isCurrent,
  ...(y._count && { _count: y._count }),
});

export async function list() {
  return (await prisma.academicYear.findMany({ include: counts, orderBy: { startDate: 'desc' } })).map(toDto);
}

export async function findOrFail(id: string) {
  const year = await prisma.academicYear.findUnique({ where: { id } });
  if (!year) throw AppError.notFound('Année académique introuvable');
  return year;
}

/** Année courante, ou null s'il n'y en a pas. */
export const getCurrent = () => prisma.academicYear.findFirst({ where: { isCurrent: true } });

async function assertLabelFree(instituteId: string, label: string, exceptId?: string) {
  const other = await prisma.academicYear.findUnique({ where: { instituteId_label: { instituteId, label } } });
  if (other && other.id !== exceptId) {
    throw new AppError(409, 'CONFLICT', 'Cette année existe déjà', { label: ['Cette année existe déjà'] });
  }
}

export async function create(data: CreateData) {
  const instituteId = await institute.getId();
  await assertLabelFree(instituteId, data.label);
  // S'il n'existe encore aucune année courante, la nouvelle le devient automatiquement
  const isCurrent = data.isCurrent === true || !(await prisma.academicYear.findFirst({ where: { isCurrent: true } }));
  return prisma.$transaction(async (tx) => {
    if (isCurrent) await tx.academicYear.updateMany({ data: { isCurrent: false } });
    const y = await tx.academicYear.create({
      data: { label: data.label, startDate: toDate(data.startDate), endDate: toDate(data.endDate), isCurrent, instituteId },
      include: counts,
    });
    return toDto(y);
  });
}

export async function update(id: string, data: UpdateData) {
  const current = await findOrFail(id);
  if (data.label) await assertLabelFree(current.instituteId, data.label, id);
  const start = data.startDate ?? fromDate(current.startDate);
  const end = data.endDate ?? fromDate(current.endDate);
  if (start >= end) throw AppError.badRequest('La fin doit être après le début', { endDate: ['La fin doit être après le début'] });
  if (data.isCurrent === false && current.isCurrent) {
    throw AppError.badRequest("Choisissez une autre année comme année courante plutôt que de décocher celle-ci");
  }

  return prisma.$transaction(async (tx) => {
    if (data.isCurrent) await tx.academicYear.updateMany({ where: { id: { not: id } }, data: { isCurrent: false } });
    const y = await tx.academicYear.update({
      where: { id },
      data: {
        ...(data.label && { label: data.label }),
        startDate: toDate(start),
        endDate: toDate(end),
        ...(data.isCurrent !== undefined && { isCurrent: data.isCurrent }),
      },
      include: counts,
    });
    return toDto(y);
  });
}

export async function remove(id: string) {
  await findOrFail(id);
  const { _count } = await prisma.academicYear.findUniqueOrThrow({
    where: { id },
    select: { _count: { select: { enrollments: true, assignments: true, timetables: true, syllabi: true } } },
  });
  assertNoDependents(_count, {
    enrollments: 'inscription(s)', assignments: 'affectation(s)', timetables: 'emploi(s) du temps', syllabi: 'syllabus',
  });
  await prisma.academicYear.delete({ where: { id } });
}
