import { Router, type Response } from 'express';
import { z } from 'zod';
import { uuidParam } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import { htmlToPdf } from '../../pdf/pdf.service';
import { renderTimetable } from '../../pdf/templates/timetable';
import * as service from './me.service';

const year = validate(z.object({ year: z.string().regex(/^\d{4}-\d{4}$/, 'Format attendu : 2026-2027') }), 'query');
const pdf = (res: Response, body: Buffer, filename: string) =>
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"`, 'Cache-Control': 'no-store' }).send(body);

/** Espaces personnels : /api/me/… — chacun ne voit QUE ses propres données. */
export const meRouter = Router();
meRouter.use(authenticate);
const student = authorize('ETUDIANT');
const teacher = authorize('ENSEIGNANT');

// ---- Étudiant ----
meRouter.get('/student', student, async (req, res) => { res.json({ space: await service.studentSpace(req.user!) }); });
meRouter.get('/results', student, year, async (req, res) => { res.json({ results: await service.myResults(req.user!, res.locals.query.year) }); });
meRouter.get('/transcript', student, year, async (req, res) => {
  const out = await service.myTranscript(req.user!, res.locals.query.year);
  pdf(res, out.pdf, out.filename);
});
meRouter.get('/certificate', student, year, async (req, res) => {
  const out = await service.myCertificate(req.user!, res.locals.query.year);
  res.set('X-Document-Reference', out.number).set('X-Reused', String(out.reused));
  pdf(res, out.pdf, out.filename);
});
meRouter.get('/certificates', student, async (req, res) => { res.json({ data: await service.myCertificates(req.user!) }); });
meRouter.get('/certificates/:id/pdf', student, validate(uuidParam('id'), 'params'), async (req, res) => {
  const out = await service.myCertificatePdf(req.user!, res.locals.params.id);
  pdf(res, out.pdf, out.filename);
});

// ---- Enseignant ----
meRouter.get('/teacher', teacher, validate(z.object({ academicYearId: z.string().uuid().optional() }), 'query'), async (req, res) => {
  res.json({ space: await service.teacherSpace(req.user!, res.locals.query.academicYearId) });
});
meRouter.get('/teacher/courses/:id/students', teacher, validate(uuidParam('id'), 'params'), validate(z.object({ academicYearId: z.string().uuid() }), 'query'), async (req, res) => {
  res.json({ course: await service.courseStudents(req.user!, res.locals.params.id, res.locals.query.academicYearId) });
});

// ---- Emploi du temps personnel (étudiant ou enseignant) ----
meRouter.get('/timetable', authorize('ETUDIANT', 'ENSEIGNANT'),
  validate(z.object({ semester: z.coerce.number().int().min(1).max(2).default(1), format: z.enum(['json', 'pdf']).default('json') }), 'query'),
  async (req, res) => {
    const v = await service.myTimetable(req.user!, res.locals.query.semester);
    if (res.locals.query.format === 'json') return void res.json({ timetable: v });
    if (!v) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: "Aucun emploi du temps publié" } });
    const inst = await prisma.institute.findFirst({ orderBy: { createdAt: 'asc' } });
    pdf(res, await htmlToPdf(renderTimetable(v, { name: inst?.name ?? 'Institut', acronym: inst?.acronym ?? null })), 'mon-emploi-du-temps.pdf');
  });
