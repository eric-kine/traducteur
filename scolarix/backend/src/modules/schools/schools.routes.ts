import { Router } from 'express';
import { createSchoolSchema, listSchoolsQuerySchema, updateSchoolSchema, uuidParam } from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import * as service from './schools.service';

const byId = validate(uuidParam('id'), 'params');
const id = (locals: Record<string, any>) => locals.params.id as string;

export const schoolsRouter = Router();
schoolsRouter.use(authenticate);

// Lecture : tout utilisateur connecté (un agent SCOLARITE ne voit que son école)
schoolsRouter.get('/', validate(listSchoolsQuerySchema, 'query'), async (req, res) => {
  res.json({ data: await service.list(req.user!, res.locals.query) });
});
schoolsRouter.get('/:id', byId, async (req, res) => {
  res.json({ school: await service.getById(req.user!, id(res.locals)) });
});

// Écriture : administrateurs uniquement
schoolsRouter.post('/', authorize('ADMIN'), validate(createSchoolSchema), async (_req, res) => {
  res.status(201).json({ school: await service.create(res.locals.body) });
});
schoolsRouter.patch('/:id', authorize('ADMIN'), byId, validate(updateSchoolSchema), async (_req, res) => {
  res.json({ school: await service.update(id(res.locals), res.locals.body) });
});
schoolsRouter.delete('/:id', authorize('ADMIN'), byId, async (_req, res) => {
  await service.remove(id(res.locals));
  res.status(204).end();
});
