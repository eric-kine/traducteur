import { Router } from 'express';
import { createLevelSchema, reorderLevelsSchema, updateLevelSchema, uuidParam } from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import * as service from './levels.service';

const manage = authorize('ADMIN', 'SCOLARITE');

/** Routes imbriquées : /api/schools/:schoolId/levels */
export const schoolLevelsRouter = Router({ mergeParams: true });
schoolLevelsRouter.use(authenticate, validate(uuidParam('schoolId'), 'params'));

schoolLevelsRouter.get('/', async (req, res) => {
  res.json({ data: await service.list(req.user!, res.locals.params.schoolId) });
});
schoolLevelsRouter.post('/', manage, validate(createLevelSchema), async (req, res) => {
  res.status(201).json({ level: await service.create(req.user!, res.locals.params.schoolId, res.locals.body) });
});
schoolLevelsRouter.put('/order', manage, validate(reorderLevelsSchema), async (req, res) => {
  res.json({ data: await service.reorder(req.user!, res.locals.params.schoolId, res.locals.body.ids) });
});

/** Routes directes : /api/levels/:id */
export const levelsRouter = Router();
levelsRouter.use(authenticate);
const byId = validate(uuidParam('id'), 'params');

levelsRouter.get('/:id', byId, async (req, res) => {
  res.json({ level: await service.getById(req.user!, res.locals.params.id) });
});
levelsRouter.patch('/:id', byId, manage, validate(updateLevelSchema), async (req, res) => {
  res.json({ level: await service.update(req.user!, res.locals.params.id, res.locals.body) });
});
levelsRouter.delete('/:id', byId, manage, async (req, res) => {
  await service.remove(req.user!, res.locals.params.id);
  res.status(204).end();
});
