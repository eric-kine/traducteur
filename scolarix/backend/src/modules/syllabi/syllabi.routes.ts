import { Router } from 'express';
import { z } from 'zod';
import { levelSyllabiQuerySchema, saveSyllabusSchema, syllabusQuerySchema, uuidParam } from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { validate } from '../../common/middlewares/validate';
import * as service from './syllabi.service';

const HTML_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";
const byId = validate(uuidParam('id'), 'params');

/**
 * Monté sur /api. Authentification sur chaque route (jamais router.use) pour ne
 * pas s'appliquer à tout /api. Lecture : tout utilisateur connecté (un agent
 * SCOLARITE reste limité à son école) ; écriture : voir service.canEdit.
 */
export const syllabiRouter = Router();

/** GET /api/ues/:id/syllabus?year=2026-2027[&format=html] → PDF du syllabus */
syllabiRouter.get('/ues/:id/syllabus', authenticate, byId, validate(syllabusQuerySchema, 'query'), async (req, res) => {
  const out = await service.renderOne(req.user!, res.locals.params.id, res.locals.query.year, res.locals.query.format);
  if ('html' in out) {
    res.type('html').set('Content-Security-Policy', HTML_CSP).send(out.html);
    return;
  }
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${out.filename}"`, 'Cache-Control': 'no-store' }).send(out.pdf);
});

/** Données pour l'éditeur (UE, enseignants, champs complémentaires) */
syllabiRouter.get('/ues/:id/syllabus/data', authenticate, byId, validate(z.object({ year: syllabusQuerySchema.shape.year }), 'query'), async (req, res) => {
  res.json({ syllabus: await service.getSyllabus(req.user!, res.locals.params.id, res.locals.query.year) });
});

/** Enregistrement des champs complémentaires */
syllabiRouter.put('/ues/:id/syllabus', authenticate, byId, validate(saveSyllabusSchema), async (req, res) => {
  res.json({ syllabus: await service.saveSyllabus(req.user!, res.locals.params.id, res.locals.body) });
});

/** GET /api/levels/:id/syllabi?year=…[&semester=1] → archive ZIP des PDF de toutes les UE du niveau */
syllabiRouter.get('/levels/:id/syllabi', authenticate, byId, validate(levelSyllabiQuerySchema, 'query'), async (req, res) => {
  await service.streamLevelZip(req.user!, res.locals.params.id, res.locals.query, res);
});
