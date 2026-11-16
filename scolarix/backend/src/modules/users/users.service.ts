import type { Prisma, Role } from '@prisma/client';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { userSelect } from '../../common/utils/user-dto';
import { hashPassword } from '../auth/password';
import { revokeAllSessions } from '../auth/auth.service';

/** Le rattachement à une école n'a de sens que pour la scolarité. */
const normalizeSchool = (role: Role, schoolId: string | null | undefined) =>
  role === 'SCOLARITE' ? (schoolId ?? null) : null;

async function assertSchoolExists(schoolId: string | null) {
  if (!schoolId) return;
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
  if (!school) throw AppError.badRequest('École introuvable', { schoolId: ['École introuvable'] });
}

export async function list(q: ListUsersQuery) {
  const where: Prisma.UserWhereInput = {
    ...(q.role && { role: q.role }),
    ...(q.isActive !== undefined && { isActive: q.isActive }),
    ...(q.search && {
      OR: [
        { email: { contains: q.search, mode: 'insensitive' } },
        { firstName: { contains: q.search, mode: 'insensitive' } },
        { lastName: { contains: q.search, mode: 'insensitive' } },
      ],
    }),
  };
  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { data, page: q.page, pageSize: q.pageSize, total };
}

export async function getById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) throw AppError.notFound('Utilisateur introuvable');
  return user;
}

export async function create(input: CreateUserInput) {
  const exists = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw AppError.conflict('Un compte existe déjà avec cet email');
  const schoolId = normalizeSchool(input.role, input.schoolId);
  await assertSchoolExists(schoolId);

  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      schoolId,
    },
    select: userSelect,
  });
}

/** Empêche de se retrouver sans aucun administrateur actif. */
async function assertNotLastAdmin(userId: string) {
  const others = await prisma.user.count({
    where: { role: 'ADMIN', isActive: true, id: { not: userId } },
  });
  if (others === 0) throw AppError.badRequest('Impossible : il doit rester au moins un administrateur actif');
}

export async function update(id: string, input: UpdateUserInput, actorId: string) {
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) throw AppError.notFound('Utilisateur introuvable');

  const losesAdmin =
    current.role === 'ADMIN' &&
    current.isActive &&
    ((input.role && input.role !== 'ADMIN') || input.isActive === false);
  if (losesAdmin) {
    if (id === actorId) throw AppError.badRequest('Vous ne pouvez pas retirer vos propres droits administrateur');
    await assertNotLastAdmin(id);
  }

  if (input.email && input.email !== current.email) {
    const taken = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (taken) throw AppError.conflict('Un compte existe déjà avec cet email');
  }

  const role = input.role ?? current.role;
  const schoolId = normalizeSchool(role, input.schoolId !== undefined ? input.schoolId : current.schoolId);
  await assertSchoolExists(schoolId);

  const user = await prisma.user.update({
    where: { id },
    data: { ...input, schoolId },
    select: userSelect,
  });
  if (input.isActive === false) await revokeAllSessions(id);
  return user;
}

/** Réinitialisation par un administrateur : toutes les sessions sont fermées. */
export async function resetPassword(id: string, password: string) {
  await getById(id);
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  await revokeAllSessions(id);
}

/** "Suppression" = désactivation : on garde l'historique (notes saisies, documents émis…). */
export async function deactivate(id: string, actorId: string) {
  if (id === actorId) throw AppError.badRequest('Vous ne pouvez pas désactiver votre propre compte');
  return update(id, { isActive: false }, actorId);
}
