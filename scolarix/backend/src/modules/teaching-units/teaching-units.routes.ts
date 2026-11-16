import { Router } from 'express';
import {
  createTeachingUnitSchema,
  listTeachingUnitsQuerySchema,
  updateTeachingUnitSchema,
  uuidParam,
} from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import * as service from './teaching-units.service';

const manage = authorize('ADMIN', 'SCOLARITE');

/** Routes imbriquées : /api/levels/:levelId/teaching-units */
export const levelTeachingUnitsRouter = Router({ mergeParams: true });
levelTeachingUnitsRouter.use(authenticate, validate(uuidParam('levelId'), 'params'));

levelTeachingUnitsRouter.get('/', validate(listTeachingUnitsQuerySchema, 'query'), async (req, res) => {
  res.json(await service.list(req.user!, res.locals.params.levelId, res.locals.query));
});
levelTeachingUnitsRouter.post('/', manage, validate(createTeachingUnitSchema), async (req, res) => {
  res.status(201).json({ teachingUnit: await service.create(req.user!, res.locals.params.levelId, res.locals.body) });
});

/** Routes directes : /api/teaching-units/:id */
export const teachingUnitsRouter = Router();
teachingUnitsRouter.use(authenticate);
const byId = validate(uuidParam('id'), 'params');

teachingUnitsRouter.get('/:id', byId, async (req, res) => {
  res.json({ teachingUnit: await service.getById(req.user!, res.locals.params.id) });
});
teachingUnitsRouter.patch('/:id', byId, manage, validate(updateTeachingUnitSchema), async (req, res) => {
  res.json({ teachingUnit: await service.update(req.user!, res.locals.params.id, res.locals.body) });
});
teachingUnitsRouter.delete('/:id', byId, manage, async (req, res) => {
  await service.remove(req.user!, res.locals.params.id);
  res.status(204).end();
});
