import { Router } from 'express';
import { z } from 'zod';
import { uuidParam } from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import * as service from './accounts.service';

/** Monté sur /api : authentification sur chaque route. */
export const accountsRouter = Router();
const staff = [authenticate, authorize('ADMIN', 'SCOLARITE')];
const byId = validate(uuidParam('id'), 'params');

accountsRouter.get('/teachers/:id/account', ...staff, byId, async (_req, res) => {
  res.json({ user: await service.linkedAccount('teacher', res.locals.params.id) });
});
accountsRouter.post('/teachers/:id/account', ...staff, byId, async (req, res) => {
  res.status(201).json(await service.createTeacherAccount(req.user!, res.locals.params.id));
});
accountsRouter.get('/students/:id/account', ...staff, byId, async (_req, res) => {
  res.json({ user: await service.linkedAccount('student', res.locals.params.id) });
});
accountsRouter.post('/students/:id/account', ...staff, byId, validate(z.object({ email: z.string().trim().toLowerCase().email('Adresse email invalide').optional() })), async (req, res) => {
  res.status(201).json(await service.createStudentAccount(req.user!, res.locals.params.id, res.locals.body.email));
});
