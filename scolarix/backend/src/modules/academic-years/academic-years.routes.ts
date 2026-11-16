import { Router } from 'express';
import { createAcademicYearSchema, updateAcademicYearSchema, uuidParam } from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import * as service from './academic-years.service';

export const academicYearsRouter = Router();
academicYearsRouter.use(authenticate);
const byId = validate(uuidParam('id'), 'params');

academicYearsRouter.get('/', async (_req, res) => {
  res.json({ data: await service.list() });
});
academicYearsRouter.post('/', authorize('ADMIN'), validate(createAcademicYearSchema), async (_req, res) => {
  res.status(201).json({ academicYear: await service.create(res.locals.body) });
});
academicYearsRouter.patch('/:id', byId, authorize('ADMIN'), validate(updateAcademicYearSchema), async (_req, res) => {
  res.json({ academicYear: await service.update(res.locals.params.id, res.locals.body) });
});
academicYearsRouter.delete('/:id', byId, authorize('ADMIN'), async (_req, res) => {
  await service.remove(res.locals.params.id);
  res.status(204).end();
});
