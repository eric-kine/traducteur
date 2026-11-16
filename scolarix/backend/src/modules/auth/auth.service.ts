import type { User } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../common/errors/AppError';
import { toPublicUser } from '../../common/utils/user-dto';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from './tokens';

interface ClientInfo {
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: ReturnType<typeof toPublicUser>;
}

const INVALID_CREDENTIALS = new AppError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect');

/** Crée un couple (jeton d'accès, jeton de rafraîchissement) pour un utilisateur. */
async function createSession(user: User, client: ClientInfo): Promise<SessionResult & { refreshId: string }> {
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 3600 * 1000);
  const stored = await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiresAt,
      userId: user.id,
      userAgent: client.userAgent?.slice(0, 255),
      ipAddress: client.ipAddress,
    },
  });
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role, schoolId: user.schoolId }),
    refreshToken,
    refreshExpiresAt,
    refreshId: stored.id,
    user: toPublicUser(user),
  };
}

export async function login(email: string, password: string, client: ClientInfo): Promise<SessionResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  // On compare toujours un hash (même factice) pour un temps de réponse constant.
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw INVALID_CREDENTIALS;
  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DISABLED', 'Ce compte est désactivé');

  const updated = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const { refreshId: _id, ...session } = await createSession(updated, client);
  return session;
}

/**
 * Rotation du jeton de rafraîchissement.
 * Si un jeton déjà révoqué est présenté, on suppose un vol : toutes les
 * sessions de l'utilisateur sont révoquées.
 */
export async function refresh(refreshToken: string | undefined, client: ClientInfo): Promise<SessionResult> {
  if (!refreshToken) throw new AppError(401, 'NO_SESSION', 'Aucune session active');

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
    include: { user: true },
  });
  if (!stored) throw new AppError(401, 'NO_SESSION', 'Aucune session active');

  if (stored.revokedAt) {
    await revokeAllSessions(stored.userId);
    throw new AppError(401, 'TOKEN_REUSED', 'Session invalide, veuillez vous reconnecter');
  }
  if (stored.expiresAt < new Date() || !stored.user.isActive) {
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    throw new AppError(401, 'SESSION_EXPIRED', 'Session expirée, veuillez vous reconnecter');
  }

  const { refreshId, ...session } = await createSession(stored.user, client);
  // Révocation conditionnelle : si deux requêtes arrivent en même temps avec le
  // même jeton, une seule réussit la rotation.
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date(), replacedById: refreshId },
  });
  if (count === 0) {
    await prisma.refreshToken.update({ where: { id: refreshId }, data: { revokedAt: new Date() } });
    throw new AppError(401, 'TOKEN_REUSED', 'Session invalide, veuillez vous reconnecter');
  }
  return session;
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('Utilisateur introuvable');
  return toPublicUser(user);
}

/** Changement de son propre mot de passe : les autres sessions sont fermées. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('Utilisateur introuvable');
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw AppError.badRequest('Mot de passe actuel incorrect', {
      currentPassword: ['Mot de passe actuel incorrect'],
    });
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  await revokeAllSessions(userId);
}
