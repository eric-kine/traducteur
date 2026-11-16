import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { uploadErrorMessage } from './upload';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route introuvable : ${req.method} ${req.path}`));
};

/** Convertit toute erreur en réponse JSON au format { error: { code, message, details? } }. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  err = uploadErrorMessage(err) ?? err;
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    });
    return;
  }
  // Contrainte d'unicité violée (ex. email déjà utilisé)
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'Cette valeur existe déjà' } });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
    res.status(400).json({ error: { code: 'BAD_REFERENCE', message: 'Référence invalide' } });
    return;
  }
  // JSON mal formé envoyé par le client
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'Corps JSON invalide' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Erreur interne du serveur' } });
};
