import { Router } from 'express';
import { z } from 'zod';
import { createUserSchema, listUsersQuerySchema, resetPasswordSchema, updateUserSchema } from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import * as ctrl from './users.controller';

const idParams = z.object({ id: z.string().uuid('Identifiant invalide') });

export const usersRouter = Router();

// Toutes les routes "utilisateurs" sont réservées aux administrateurs.
usersRouter.use(authenticate, authorize('ADMIN'));

usersRouter.get('/', validate(listUsersQuerySchema, 'query'), ctrl.list);
usersRouter.post('/', validate(createUserSchema), ctrl.create);
usersRouter.get('/:id', validate(idParams, 'params'), ctrl.getOne);
usersRouter.patch('/:id', validate(idParams, 'params'), validate(updateUserSchema), ctrl.update);
usersRouter.post('/:id/reset-password', validate(idParams, 'params'), validate(resetPasswordSchema), ctrl.resetPassword);
usersRouter.delete('/:id', validate(idParams, 'params'), ctrl.deactivate);
