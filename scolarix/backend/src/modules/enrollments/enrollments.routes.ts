import { Router } from 'express';
import { createEnrollmentSchema, listEnrollmentsQuerySchema, updateEnrollmentSchema, uuidParam } from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import * as service from './enrollments.service';

export const enrollmentsRouter = Router();
enrollmentsRouter.use(authenticate, authorize('ADMIN', 'SCOLARITE'));
const byId = validate(uuidParam('id'), 'params');

enrollmentsRouter.get('/', validate(listEnrollmentsQuerySchema, 'query'), async (req, res) => {
  res.json({ data: await service.list(req.user!, res.locals.query) });
});
enrollmentsRouter.post('/', validate(createEnrollmentSchema), async (req, res) => {
  res.status(201).json({ enrollment: await service.create(req.user!, res.locals.body) });
});
enrollmentsRouter.patch('/:id', byId, validate(updateEnrollmentSchema), async (req, res) => {
  res.json({ enrollment: await service.update(req.user!, res.locals.params.id, res.locals.body) });
});
enrollmentsRouter.delete('/:id', byId, async (req, res) => {
  await service.remove(req.user!, res.locals.params.id);
  res.status(204).end();
});
