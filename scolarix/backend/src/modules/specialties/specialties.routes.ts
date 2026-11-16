import { Router } from 'express';
import { createSpecialtySchema, listSpecialtiesQuerySchema, updateSpecialtySchema, uuidParam } from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import * as service from './specialties.service';

const manage = authorize('ADMIN', 'SCOLARITE');

/** Routes imbriquées : /api/schools/:schoolId/specialties */
export const schoolSpecialtiesRouter = Router({ mergeParams: true });
schoolSpecialtiesRouter.use(authenticate, validate(uuidParam('schoolId'), 'params'));

schoolSpecialtiesRouter.get('/', validate(listSpecialtiesQuerySchema, 'query'), async (req, res) => {
  res.json({ data: await service.list(req.user!, res.locals.params.schoolId, res.locals.query) });
});
schoolSpecialtiesRouter.post('/', manage, validate(createSpecialtySchema), async (req, res) => {
  res.status(201).json({ specialty: await service.create(req.user!, res.locals.params.schoolId, res.locals.body) });
});

/** Routes directes : /api/specialties/:id */
export const specialtiesRouter = Router();
specialtiesRouter.use(authenticate);
const byId = validate(uuidParam('id'), 'params');

specialtiesRouter.get('/:id', byId, async (req, res) => {
  res.json({ specialty: await service.getById(req.user!, res.locals.params.id) });
});
specialtiesRouter.patch('/:id', byId, manage, validate(updateSpecialtySchema), async (req, res) => {
  res.json({ specialty: await service.update(req.user!, res.locals.params.id, res.locals.body) });
});
specialtiesRouter.delete('/:id', byId, manage, async (req, res) => {
  await service.remove(req.user!, res.locals.params.id);
  res.status(204).end();
});
