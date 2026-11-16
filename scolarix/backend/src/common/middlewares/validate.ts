import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../errors/AppError';

type Source = 'body' | 'query' | 'params';

/**
 * Valide req.body / req.query / req.params avec un schéma Zod.
 * Le résultat nettoyé est stocké dans res.locals.<source> (req.query est en
 * lecture seule avec Express 5).
 */
export const validate =
  (schema: ZodTypeAny, source: Source = 'body'): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        (details[key] ??= []).push(issue.message);
      }
      return next(AppError.badRequest('Données invalides', details));
    }
    res.locals[source] = result.data;
    next();
  };
