import { Router } from 'express';
import type { Room } from '@prisma/client';
import { roomSchema, updateRoomSchema, uuidParam, type RoomDto, type Unavailability } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { assertNoDependents } from '../../common/utils/dependents';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import * as institute from '../institute/institute.service';

const toDto = (r: Room): RoomDto => ({
  id: r.id, code: r.code, name: r.name, building: r.building, capacity: r.capacity, supportedTypes: r.supportedTypes,
  isActive: r.isActive, unavailability: (r.unavailability as Unavailability | null) ?? [],
});

async function assertCodeFree(code: string, exceptId?: string) {
  const other = await prisma.room.findUnique({ where: { code }, select: { id: true } });
  if (other && other.id !== exceptId) throw new AppError(409, 'CONFLICT', 'Code déjà utilisé', { code: ['Une salle porte déjà ce code'] });
}

/** Salles : partagées par toutes les écoles. Lecture : administration et scolarité ; écriture : ADMIN. */
export const roomsRouter = Router();
roomsRouter.use(authenticate, authorize('ADMIN', 'SCOLARITE'));
const byId = validate(uuidParam('id'), 'params');

roomsRouter.get('/', async (_req, res) => {
  res.json({ data: (await prisma.room.findMany({ orderBy: { code: 'asc' } })).map(toDto) });
});
roomsRouter.post('/', authorize('ADMIN'), validate(roomSchema), async (_req, res) => {
  await assertCodeFree(res.locals.body.code);
  const room = await prisma.room.create({ data: { ...res.locals.body, instituteId: await institute.getId() } });
  res.status(201).json({ room: toDto(room) });
});
roomsRouter.patch('/:id', byId, authorize('ADMIN'), validate(updateRoomSchema), async (_req, res) => {
  const id = res.locals.params.id;
  if (!(await prisma.room.findUnique({ where: { id } }))) throw AppError.notFound('Salle introuvable');
  if (res.locals.body.code) await assertCodeFree(res.locals.body.code, id);
  res.json({ room: toDto(await prisma.room.update({ where: { id }, data: res.locals.body })) });
});
roomsRouter.delete('/:id', byId, authorize('ADMIN'), async (_req, res) => {
  const id = res.locals.params.id;
  const r = await prisma.room.findUnique({ where: { id }, select: { _count: { select: { sessions: true } } } });
  if (!r) throw AppError.notFound('Salle introuvable');
  assertNoDependents(r._count, { sessions: 'séance(s) d’emploi du temps' });
  await prisma.room.delete({ where: { id } });
  res.status(204).end();
});
