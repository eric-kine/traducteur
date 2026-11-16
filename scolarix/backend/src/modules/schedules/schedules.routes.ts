import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  addSessionSchema, generateScheduleSchema, moveSessionSchema, timeslotsSchema, timetableViewQuerySchema, unavailabilitySchema, uuidParam,
  type TimetableView,
} from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import { htmlToPdf } from '../../pdf/pdf.service';
import { renderTimetable } from '../../pdf/templates/timetable';
import * as service from './schedules.service';

const byId = validate(uuidParam('id'), 'params');
const staff = authorize('ADMIN', 'SCOLARITE');

async function sendView(res: Response, view: TimetableView, format: 'json' | 'pdf', filename: string) {
  if (format === 'json') return void res.json({ timetable: view });
  const inst = await prisma.institute.findFirst({ orderBy: { createdAt: 'asc' } });
  const pdf = await htmlToPdf(renderTimetable(view, { name: inst?.name ?? 'Institut', acronym: inst?.acronym ?? null }));
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"`, 'Cache-Control': 'no-store' }).send(pdf);
}
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- Grille horaire : /api/timeslots ----
export const timeslotsRouter = Router();
timeslotsRouter.use(authenticate);
timeslotsRouter.get('/', async (_req, res) => { res.json({ data: await service.getTimeslots() }); });
timeslotsRouter.put('/', authorize('ADMIN'), validate(timeslotsSchema), async (_req, res) => {
  res.json({ data: await service.setTimeslots(res.locals.body.slots) });
});

// ---- Emplois du temps de niveau : /api/schedules ----
export const schedulesRouter = Router();
schedulesRouter.use(authenticate, staff);

/** ?levelId=&academicYearId=&semester= → grille du niveau (null si pas encore générée) */
schedulesRouter.get('/', validate(z.object({ levelId: z.string().uuid(), academicYearId: z.string().uuid(), semester: z.coerce.number().int().min(1).max(2) }), 'query'), async (req, res) => {
  const q = res.locals.query;
  res.json({ timetable: await service.findSchedule(req.user!, q.levelId, q.academicYearId, q.semester) });
});
/** Génération automatique (les séances épinglées sont conservées) */
schedulesRouter.post('/generate', validate(generateScheduleSchema), async (req, res) => {
  res.json({ timetable: await service.generate(req.user!, res.locals.body) });
});
schedulesRouter.get('/:id', byId, async (req, res) => { res.json({ timetable: await service.levelView(req.user!, res.locals.params.id) }); });
schedulesRouter.get('/:id/pdf', byId, async (req, res) => {
  const v = await service.levelView(req.user!, res.locals.params.id);
  await sendView(res, v, 'pdf', `edt-${slug(v.title)}-S${v.schedule!.semester}-${v.schedule!.academicYear.label}.pdf`);
});
schedulesRouter.patch('/:id', byId, validate(z.object({ status: z.enum(['BROUILLON', 'PUBLIE']) })), async (req, res) => {
  res.json({ timetable: await service.setStatus(req.user!, res.locals.params.id, res.locals.body.status) });
});
schedulesRouter.delete('/:id', byId, async (req, res) => { await service.removeSchedule(req.user!, res.locals.params.id); res.status(204).end(); });
schedulesRouter.post('/:id/sessions', byId, validate(addSessionSchema), async (req, res) => {
  res.status(201).json({ timetable: await service.addSession(req.user!, res.locals.params.id, res.locals.body) });
});

// ---- Séances : /api/schedule-sessions/:id ----
export const sessionsRouter = Router();
sessionsRouter.use(authenticate, staff);
sessionsRouter.patch('/:id', byId, validate(moveSessionSchema), async (req, res) => {
  res.json({ timetable: await service.moveSession(req.user!, res.locals.params.id, res.locals.body) });
});
sessionsRouter.delete('/:id', byId, async (req, res) => { res.json({ timetable: await service.deleteSession(req.user!, res.locals.params.id) }); });

// ---- Vues enseignant / salle : /api/timetables/(teacher|room)/:id ----
export const timetablesRouter = Router();
timetablesRouter.use(authenticate, staff);
timetablesRouter.get('/teacher/:id', byId, validate(timetableViewQuerySchema, 'query'), async (_req, res) => {
  const q = res.locals.query;
  const v = await service.teacherView(res.locals.params.id, q.academicYearId, q.semester);
  await sendView(res, v, q.format, `edt-${slug(v.title)}-S${q.semester}.pdf`);
});
timetablesRouter.get('/room/:id', byId, validate(timetableViewQuerySchema, 'query'), async (_req, res) => {
  const q = res.locals.query;
  const v = await service.roomView(res.locals.params.id, q.academicYearId, q.semester);
  await sendView(res, v, q.format, `edt-${slug(v.title)}-S${q.semester}.pdf`);
});

export { unavailabilitySchema };
