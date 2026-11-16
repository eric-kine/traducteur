import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { AppError } from '../errors/AppError';

/** Autorise uniquement les rôles listés. À placer après `authenticate`. */
export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
