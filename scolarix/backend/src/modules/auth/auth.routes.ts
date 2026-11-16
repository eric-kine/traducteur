import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { changePasswordSchema, loginSchema } from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { validate } from '../../common/middlewares/validate';
import * as ctrl from './auth.controller';

/** Limite les essais de connexion : 10 tentatives / 15 min par adresse IP. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: { code: 'TOO_MANY_ATTEMPTS', message: 'Trop de tentatives, réessayez dans 15 minutes' } },
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate(loginSchema), ctrl.login);
authRouter.post('/refresh', ctrl.refresh);
authRouter.post('/logout', ctrl.logout);
authRouter.get('/me', authenticate, ctrl.me);
authRouter.post('/change-password', authenticate, validate(changePasswordSchema), ctrl.changePassword);
