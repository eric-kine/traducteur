import { Router } from 'express';
import { instituteSchema } from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import * as service from './institute.service';

export const instituteRouter = Router();
instituteRouter.use(authenticate);

instituteRouter.get('/', async (_req, res) => {
  res.json({ institute: await service.get() });
});

instituteRouter.put('/', authorize('ADMIN'), validate(instituteSchema), async (_req, res) => {
  res.json({ institute: await service.upsert(res.locals.body) });
});
