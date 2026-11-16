import { Router } from 'express';
import { z } from 'zod';
import { createTeacherSchema, listTeachersQuerySchema, unavailabilitySchema, updateTeacherSchema, uuidParam } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import * as service from './teachers.service';

export const teachersRouter = Router();
teachersRouter.use(authenticate, authorize('ADMIN', 'SCOLARITE'));
const byId = validate(uuidParam('id'), 'params');

teachersRouter.get('/', validate(listTeachersQuerySchema, 'query'), async (_req, res) => {
  res.json({ data: await service.list(res.locals.query) });
});
teachersRouter.post('/', validate(createTeacherSchema), async (_req, res) => {
  res.status(201).json({ teacher: await service.create(res.locals.body) });
});
teachersRouter.get('/:id', byId, async (_req, res) => {
  res.json({ teacher: service.toDto(await service.findOrFail(res.locals.params.id)) });
});
teachersRouter.get('/:id/service', byId, validate(z.object({ academicYearId: z.string().uuid() }), 'query'), async (_req, res) => {
  res.json({ service: await service.serviceSummary(res.locals.params.id, res.locals.query.academicYearId) });
});
teachersRouter.patch('/:id', byId, validate(updateTeacherSchema), async (_req, res) => {
  res.json({ teacher: await service.update(res.locals.params.id, res.locals.body) });
});
/** Créneaux où l'enseignant n'est pas disponible (utilisés par le générateur d'emploi du temps) */
teachersRouter.put('/:id/unavailability', byId, validate(z.object({ unavailability: unavailabilitySchema })), async (_req, res) => {
  await service.findOrFail(res.locals.params.id);
  const t = await prisma.teacher.update({ where: { id: res.locals.params.id }, data: { unavailability: res.locals.body.unavailability } });
  res.json({ teacher: service.toDto(t) });
});
// Suppression définitive : administrateurs uniquement
teachersRouter.delete('/:id', byId, authorize('ADMIN'), async (_req, res) => {
  await service.remove(res.locals.params.id);
  res.status(204).end();
});
