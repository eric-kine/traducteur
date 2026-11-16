import type { User } from '@prisma/client';

/** Champs d'un utilisateur exposés par l'API (jamais le hash du mot de passe). */
export const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  schoolId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export type PublicUser = Pick<User, keyof typeof userSelect>;

export function toPublicUser(u: User): PublicUser {
  const { passwordHash: _ignored, updatedAt: _u, ...rest } = u;
  return rest;
}
