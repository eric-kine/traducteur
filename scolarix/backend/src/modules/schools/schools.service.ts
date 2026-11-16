import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { createSchoolSchema, listSchoolsQuerySchema, updateSchoolSchema } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { assertNoDependents } from '../../common/utils/dependents';
import type { AuthUser } from '../../common/types';
import { assertSchoolAccess, getSchoolScope } from '../../common/middlewares/school-scope';
import * as institute from '../institute/institute.service';

type CreateData = z.output<typeof createSchoolSchema>;
type UpdateData = z.output<typeof updateSchoolSchema>;
type ListQuery = z.output<typeof listSchoolsQuerySchema>;

/** Une école + le nombre de spécialités / niveaux / étudiants (affiché dans la liste). */
const withCounts = { _count: { select: { specialties: true, levels: true, students: true } } } as const;

export async function list(user: AuthUser, q: ListQuery) {
  const scope = getSchoolScope(user);
  const where: Prisma.SchoolWhereInput = {
    ...(scope && { id: scope }),
    ...(q.isActive !== undefined && { isActive: q.isActive }),
    ...(q.search && {
      OR: [
        { name: { contains: q.search, mode: 'insensitive' } },
        { code: { contains: q.search, mode: 'insensitive' } },
      ],
    }),
  };
  return prisma.school.findMany({ where, include: withCounts, orderBy: { name: 'asc' } });
}

export async function getById(user: AuthUser, id: string) {
  const school = await prisma.school.findUnique({ where: { id }, include: withCounts });
  if (!school) throw AppError.notFound('École introuvable');
  assertSchoolAccess(user, id);
  return school;
}

async function assertCodeFree(code: string, exceptId?: string) {
  const other = await prisma.school.findUnique({ where: { code }, select: { id: true } });
  if (other && other.id !== exceptId) {
    throw new AppError(409, 'CONFLICT', 'Ce code est déjà utilisé', { code: ['Ce code est déjà utilisé par une autre école'] });
  }
}

export async function create(data: CreateData) {
  await assertCodeFree(data.code);
  return prisma.school.create({
    data: { ...data, instituteId: await institute.getId() },
    include: withCounts,
  });
}

export async function update(id: string, data: UpdateData) {
  const exists = await prisma.school.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw AppError.notFound('École introuvable');
  if (data.code) await assertCodeFree(data.code, id);
  return prisma.school.update({ where: { id }, data, include: withCounts });
}

/** Suppression définitive, seulement si l'école est vide. Sinon : la désactiver. */
export async function remove(id: string) {
  const school = await prisma.school.findUnique({ where: { id }, include: withCounts });
  if (!school) throw AppError.notFound('École introuvable');
  assertNoDependents(school._count, { specialties: 'spécialité(s)', levels: 'niveau(x)', students: 'étudiant(s)' });
  await prisma.school.delete({ where: { id } });
}
