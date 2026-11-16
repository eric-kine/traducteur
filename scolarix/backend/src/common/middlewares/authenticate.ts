import type { RequestHandler } from 'express';
import { prisma } from '../../config/prisma';
import { verifyAccessToken } from '../../modules/auth/tokens';
import { AppError } from '../errors/AppError';
import '../types';

/**
 * Vérifie le jeton "Authorization: Bearer <jwt>" puis recharge l'utilisateur
 * en base : un compte désactivé ou un rôle modifié prend effet immédiatement.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(AppError.unauthorized());

  const payload = verifyAccessToken(header.slice(7));
  if (!payload) return next(new AppError(401, 'TOKEN_INVALID', 'Session expirée ou invalide'));

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, schoolId: true, isActive: true },
  });
  if (!user || !user.isActive) return next(AppError.unauthorized('Compte inactif ou supprimé'));

  req.user = { id: user.id, email: user.email, role: user.role, schoolId: user.schoolId };
  next();
};
