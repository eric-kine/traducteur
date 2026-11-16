import { Router } from 'express';
import { z } from 'zod';
import { gradeSheetQuerySchema, saveGradeSheetSchema, transcriptQuerySchema, uuidParam } from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import { htmlToPdf } from '../../pdf/pdf.service';
import { renderTranscript } from '../../pdf/templates/transcript';
import { sampleTranscript } from '../../pdf/templates/transcript.sample';
import * as grades from './grades.service';
import * as results from './results.service';
import { issueTranscript } from './transcript.service';

/** Monté sur /api (avant les autres routeurs) : notes, résultats, délibération, relevés. */
export const gradesRouter = Router();
// Pas de gradesRouter.use(authenticate) : ce routeur est monté sur /api, la vérification
// de connexion est donc placée sur chaque route (sinon elle s'appliquerait à tout /api).

const yearBody = validate(z.object({ academicYearId: z.string().uuid() }));
const yearQuery = validate(z.object({ academicYearId: z.string().uuid() }), 'query');
const staff = authorize('ADMIN', 'SCOLARITE');

// ---- Feuille de notes d'une UE ----
gradesRouter.get('/teaching-units/:id/grades', authenticate, authorize('ADMIN', 'SCOLARITE', 'ENSEIGNANT'), validate(uuidParam('id'), 'params'),
  validate(gradeSheetQuerySchema, 'query'), async (req, res) => {
    const q = res.locals.query;
    res.json({ sheet: await grades.getSheet(req.user!, res.locals.params.id, q.academicYearId, q.session) });
  });
gradesRouter.put('/teaching-units/:id/grades', authenticate, authorize('ADMIN', 'SCOLARITE', 'ENSEIGNANT'), validate(uuidParam('id'), 'params'),
  validate(saveGradeSheetSchema), async (req, res) => {
    res.json({ sheet: await grades.saveSheet(req.user!, res.locals.params.id, res.locals.body) });
  });

// ---- Résultats ----
gradesRouter.get('/enrollments/:id/results', authenticate, staff, validate(uuidParam('id'), 'params'), async (req, res) => {
  res.json({ results: await results.getEnrollmentResults(req.user!, res.locals.params.id) });
});
gradesRouter.get('/levels/:id/results', authenticate, staff, validate(uuidParam('id'), 'params'), yearQuery, async (req, res) => {
  res.json({ data: await results.levelResults(req.user!, res.locals.params.id, res.locals.query.academicYearId) });
});
gradesRouter.post('/levels/:id/deliberation', authenticate, staff, validate(uuidParam('id'), 'params'), yearBody, async (req, res) => {
  res.json(await results.deliberate(req.user!, res.locals.params.id, res.locals.body.academicYearId));
});
gradesRouter.post('/levels/:id/deliberation/reopen', authenticate, authorize('ADMIN'), validate(uuidParam('id'), 'params'), yearBody, async (_req, res) => {
  res.json(await results.reopen(res.locals.params.id, res.locals.body.academicYearId));
});

// ---- Relevé de notes : GET /api/students/:id/transcript?year=2026-2027[&format=html] ----
gradesRouter.get('/students/:id/transcript', authenticate, staff, validate(uuidParam('id'), 'params'), validate(transcriptQuerySchema, 'query'), async (req, res) => {
  const { year, format } = res.locals.query;
  const out = await issueTranscript(req.user!, res.locals.params.id, year, format);
  if ('html' in out) {
    res.type('html').set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:").send(out.html);
    return;
  }
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${out.filename}"`,
    'X-Document-Reference': out.reference,
    'Cache-Control': 'no-store',
  });
  res.send(out.pdf);
});

// ---- Aperçu du gabarit avec des données fictives ----
gradesRouter.get('/transcripts/preview', authenticate, staff, validate(z.object({ format: z.enum(['html', 'pdf']).default('html') }), 'query'), async (_req, res) => {
  const html = renderTranscript(sampleTranscript());
  if (res.locals.query.format === 'html') {
    res.type('html').set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:").send(html);
    return;
  }
  res.type('application/pdf').send(await htmlToPdf(html));
});
