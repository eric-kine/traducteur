import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { createLevelSchema, updateLevelSchema } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { assertNoDependents } from '../../common/utils/dependents';
import type { AuthUser } from '../../common/types';
import { assertCanManageSchool, assertSchoolAccess } from '../../common/middlewares/school-scope';

type CreateData = z.output<typeof createLevelSchema>;
type UpdateData = z.output<typeof updateLevelSchema>;
type Tx = Prisma.TransactionClient;

/** Décalage temporaire : évite de violer l'unicité (école, ordre) pendant un réordonnancement. */
const TEMP_OFFSET = 1000;

/**
 * Applique un ordre complet : ids[0] devient 1, ids[1] devient 2…
 * Deux passes (valeurs temporaires puis définitives) car l'unicité
 * (schoolId, order) est vérifiée à chaque UPDATE.
 */
async function applyOrder(tx: Tx, ids: string[]) {
  for (const [i, id] of ids.entries()) {
    await tx.level.update({ where: { id }, data: { order: TEMP_OFFSET + i + 1 } });
  }
  for (const [i, id] of ids.entries()) {
    await tx.level.update({ where: { id }, data: { order: i + 1 } });
  }
}

const orderedIds = async (tx: Tx, schoolId: string) =>
  (await tx.level.findMany({ where: { schoolId }, orderBy: { order: 'asc' }, select: { id: true } })).map(
    (l) => l.id,
  );

async function assertSchoolExists(schoolId: string) {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
  if (!school) throw AppError.notFound('École introuvable');
}

async function findOrFail(id: string) {
  const level = await prisma.level.findUnique({ where: { id } });
  if (!level) throw AppError.notFound('Niveau introuvable');
  return level;
}

async function assertCodeFree(schoolId: string, code: string, exceptId?: string) {
  const other = await prisma.level.findUnique({ where: { schoolId_code: { schoolId, code } }, select: { id: true } });
  if (other && other.id !== exceptId) {
    throw new AppError(409, 'CONFLICT', 'Ce code est déjà utilisé', {
      code: ['Ce code est déjà utilisé dans cette école'],
    });
  }
}

export async function list(user: AuthUser, schoolId: string) {
  await assertSchoolExists(schoolId);
  assertSchoolAccess(user, schoolId);
  return prisma.level.findMany({ where: { schoolId }, orderBy: { order: 'asc' } });
}

export async function getById(user: AuthUser, id: string) {
  const level = await findOrFail(id);
  assertSchoolAccess(user, level.schoolId);
  return level;
}

/** Création : placé à la position demandée (les suivants sont décalés) ou à la fin. */
export async function create(user: AuthUser, schoolId: string, { order, ...data }: CreateData) {
  await assertSchoolExists(schoolId);
  assertCanManageSchool(user, schoolId);
  await assertCodeFree(schoolId, data.code);

  return prisma.$transaction(async (tx) => {
    const ids = await orderedIds(tx, schoolId);
    const level = await tx.level.create({ data: { ...data, schoolId, order: TEMP_OFFSET * 2 } });
    const position = Math.min(Math.max((order ?? ids.length + 1) - 1, 0), ids.length);
    ids.splice(position, 0, level.id);
    await applyOrder(tx, ids);
    return tx.level.findUniqueOrThrow({ where: { id: level.id } });
  });
}

export async function update(user: AuthUser, id: string, data: UpdateData) {
  const current = await findOrFail(id);
  assertCanManageSchool(user, current.schoolId);
  if (data.code) await assertCodeFree(current.schoolId, data.code, id);
  return prisma.level.update({ where: { id }, data });
}

/** Réordonne tous les niveaux d'une école (la liste doit contenir exactement tous leurs ids). */
export async function reorder(user: AuthUser, schoolId: string, ids: string[]) {
  await assertSchoolExists(schoolId);
  assertCanManageSchool(user, schoolId);
  return prisma.$transaction(async (tx) => {
    const current = await orderedIds(tx, schoolId);
    const same = current.length === ids.length && current.every((id) => ids.includes(id));
    if (!same) throw AppError.badRequest("La liste doit contenir exactement tous les niveaux de l'école");
    await applyOrder(tx, ids);
    return tx.level.findMany({ where: { schoolId }, orderBy: { order: 'asc' } });
  });
}

/** Suppression si aucune donnée rattachée ; l'ordre des suivants est recompacté. */
export async function remove(user: AuthUser, id: string) {
  const current = await findOrFail(id);
  assertCanManageSchool(user, current.schoolId);
  const { _count } = await prisma.level.findUniqueOrThrow({
    where: { id },
    select: { _count: { select: { teachingUnits: true, enrollments: true, schedules: true } } },
  });
  assertNoDependents(_count, { teachingUnits: 'UE', enrollments: 'inscription(s)', schedules: 'emploi(s) du temps' });

  await prisma.$transaction(async (tx) => {
    await tx.level.delete({ where: { id } });
    await applyOrder(tx, await orderedIds(tx, current.schoolId));
  });
}
