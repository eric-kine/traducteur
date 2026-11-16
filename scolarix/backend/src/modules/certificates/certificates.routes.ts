import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { certificateQuerySchema, listCertificatesQuerySchema, revokeCertificateSchema, uuidParam, verificationCodeParam } from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import * as service from './certificates.service';

const HTML_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";
const sendPdf = (res: import('express').Response, pdf: Buffer, filename: string, extra: Record<string, string> = {}) =>
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"`, 'Cache-Control': 'no-store', ...extra }).send(pdf);

/** Monté sur /api (avant le routeur étudiants). */
export const certificatesRouter = Router();
const staff = [authenticate, authorize('ADMIN', 'SCOLARITE')];

/**
 * GET /api/students/:id/certificate?year=2026-2027[&purpose=…][&format=html]
 * pdf (par défaut) : ÉMET un nouveau certificat numéroté et renvoie le PDF.
 * html : aperçu, sans numéro ni enregistrement.
 */
certificatesRouter.get('/students/:id/certificate', ...staff, validate(uuidParam('id'), 'params'), validate(certificateQuerySchema, 'query'), async (req, res) => {
  const { year, purpose, format } = res.locals.query;
  if (format === 'html') {
    res.type('html').set('Content-Security-Policy', HTML_CSP).send(await service.preview(req.user!, res.locals.params.id, year, purpose));
    return;
  }
  const out = await service.issue(req.user!, res.locals.params.id, year, purpose);
  sendPdf(res, out.pdf, out.filename, { 'X-Document-Reference': out.number, 'X-Certificate-Id': out.id });
});

// Historique, duplicata, annulation
certificatesRouter.get('/certificates', ...staff, validate(listCertificatesQuerySchema, 'query'), async (req, res) => {
  res.json(await service.list(req.user!, res.locals.query));
});
certificatesRouter.get('/certificates/:id/pdf', ...staff, validate(uuidParam('id'), 'params'), async (req, res) => {
  const out = await service.duplicate(req.user!, res.locals.params.id);
  sendPdf(res, out.pdf, out.filename);
});
certificatesRouter.post('/certificates/:id/revoke', ...staff, validate(uuidParam('id'), 'params'), validate(revokeCertificateSchema), async (req, res) => {
  res.json({ certificate: await service.revoke(req.user!, res.locals.params.id, res.locals.body.reason) });
});

/** Vérification publique (QR code) — sans connexion, limitée à 30 requêtes / minute / IP. */
export const publicVerifyRouter = Router();
publicVerifyRouter.get(
  '/:code',
  rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test',
    message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Trop de vérifications, réessayez dans une minute' } } }),
  validate(verificationCodeParam, 'params'),
  async (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ result: await service.verify(res.locals.params.code) });
  },
);
