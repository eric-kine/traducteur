import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { createSpecialtySchema, listSpecialtiesQuerySchema, updateSpecialtySchema } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { assertNoDependents } from '../../common/utils/dependents';
import type { AuthUser } from '../../common/types';
import { assertCanManageSchool, assertSchoolAccess } from '../../common/middlewares/school-scope';

type CreateData = z.output<typeof createSpecialtySchema>;
type UpdateData = z.output<typeof updateSpecialtySchema>;
type ListQuery = z.output<typeof listSpecialtiesQuerySchema>;

async function assertSchoolExists(schoolId: string) {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
  if (!school) throw AppError.notFound('École introuvable');
}

async function findOrFail(id: string) {
  const specialty = await prisma.specialty.findUnique({ where: { id } });
  if (!specialty) throw AppError.notFound('Spécialité introuvable');
  return specialty;
}

async function assertCodeFree(schoolId: string, code: string, exceptId?: string) {
  const other = await prisma.specialty.findUnique({
    where: { schoolId_code: { schoolId, code } },
    select: { id: true },
  });
  if (other && other.id !== exceptId) {
    throw new AppError(409, 'CONFLICT', 'Ce code est déjà utilisé', {
      code: ['Ce code est déjà utilisé dans cette école'],
    });
  }
}

export async function list(user: AuthUser, schoolId: string, q: ListQuery) {
  await assertSchoolExists(schoolId);
  assertSchoolAccess(user, schoolId);
  const where: Prisma.SpecialtyWhereInput = {
    schoolId,
    ...(q.isActive !== undefined && { isActive: q.isActive }),
    ...(q.search && {
      OR: [
        { name: { contains: q.search, mode: 'insensitive' } },
        { code: { contains: q.search, mode: 'insensitive' } },
      ],
    }),
  };
  return prisma.specialty.findMany({ where, orderBy: { name: 'asc' } });
}

export async function getById(user: AuthUser, id: string) {
  const specialty = await findOrFail(id);
  assertSchoolAccess(user, specialty.schoolId);
  return specialty;
}

export async function create(user: AuthUser, schoolId: string, data: CreateData) {
  await assertSchoolExists(schoolId);
  assertCanManageSchool(user, schoolId);
  await assertCodeFree(schoolId, data.code);
  return prisma.specialty.create({ data: { ...data, schoolId } });
}

export async function update(user: AuthUser, id: string, data: UpdateData) {
  const current = await findOrFail(id);
  assertCanManageSchool(user, current.schoolId);
  if (data.code) await assertCodeFree(current.schoolId, data.code, id);
  return prisma.specialty.update({ where: { id }, data });
}

export async function remove(user: AuthUser, id: string) {
  const current = await findOrFail(id);
  assertCanManageSchool(user, current.schoolId);
  const counts = await prisma.specialty.findUniqueOrThrow({
    where: { id },
    select: { _count: { select: { teachingUnits: true, enrollments: true, sessions: true } } },
  });
  assertNoDependents(counts._count, {
    teachingUnits: 'UE',
    enrollments: 'inscription(s)',
    sessions: 'séance(s) d’emploi du temps',
  });
  await prisma.specialty.delete({ where: { id } });
}
