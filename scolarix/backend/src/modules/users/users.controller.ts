import type { Request, Response } from 'express';
import type { CreateUserInput, ListUsersQuery, ResetPasswordInput, UpdateUserInput } from '@scolarix/shared';
import * as usersService from './users.service';

const id = (res: Response) => (res.locals.params as { id: string }).id;

export async function list(_req: Request, res: Response) {
  res.json(await usersService.list(res.locals.query as ListUsersQuery));
}

export async function getOne(_req: Request, res: Response) {
  res.json({ user: await usersService.getById(id(res)) });
}

export async function create(_req: Request, res: Response) {
  const user = await usersService.create(res.locals.body as CreateUserInput);
  res.status(201).json({ user });
}

export async function update(req: Request, res: Response) {
  const user = await usersService.update(id(res), res.locals.body as UpdateUserInput, req.user!.id);
  res.json({ user });
}

export async function resetPassword(req: Request, res: Response) {
  await usersService.resetPassword(id(res), (res.locals.body as ResetPasswordInput).password);
  res.status(204).end();
}

export async function deactivate(req: Request, res: Response) {
  const user = await usersService.deactivate(id(res), req.user!.id);
  res.json({ user });
}
