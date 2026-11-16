import { Router } from 'express';
import { z } from 'zod';
import { createAssignmentSchema, listAssignmentsQuerySchema, updateAssignmentSchema, uuidParam } from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import * as service from './assignments.service';

export const assignmentsRouter = Router();
assignmentsRouter.use(authenticate, authorize('ADMIN', 'SCOLARITE'));
const byId = validate(uuidParam('id'), 'params');

assignmentsRouter.get('/', validate(listAssignmentsQuerySchema, 'query'), async (req, res) => {
  res.json({ data: await service.list(req.user!, res.locals.query) });
});
assignmentsRouter.post('/', validate(createAssignmentSchema), async (req, res) => {
  res.status(201).json({ assignment: await service.create(req.user!, res.locals.body) });
});
assignmentsRouter.patch('/:id', byId, validate(updateAssignmentSchema), async (req, res) => {
  res.json({ assignment: await service.update(req.user!, res.locals.params.id, res.locals.body) });
});
assignmentsRouter.delete('/:id', byId, async (req, res) => {
  await service.remove(req.user!, res.locals.params.id);
  res.status(204).end();
});

/** Couverture d'une UE : /api/teaching-units/:id/coverage?academicYearId=… */
export const coverageRouter = Router({ mergeParams: true });
coverageRouter.get(
  '/',
  authenticate,
  authorize('ADMIN', 'SCOLARITE'),
  validate(uuidParam('id'), 'params'),
  validate(z.object({ academicYearId: z.string().uuid() }), 'query'),
  async (req, res) => {
    res.json({ coverage: await service.coverage(req.user!, res.locals.params.id, res.locals.query.academicYearId) });
  },
);
