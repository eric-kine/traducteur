import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../../src/config/prisma';
import { app, as, createUser, loginAs, resetDb } from '../helpers';

let admin: ReturnType<typeof as>;
let token: string;
let schoolId: string;
let studentId: string;
let enrollmentId: string;

const binary = (r: request.Request) =>
  r.buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
const issue = (id = studentId, year = '2026-2027', extra = '') =>
  binary(request(app).get(`/api/students/${id}/certificate?year=${year}${extra}`).set('Authorization', `Bearer ${token}`));

beforeEach(async () => {
  await resetDb();
  await createUser('ADMIN', 'admin@test.local');
  token = (await loginAs('admin@test.local')).token;
  admin = as(token);
  await prisma.institute.create({ data: { name: 'Institut Test', city: 'Dakar', directorName: 'Pr Test' } });
  schoolId = (await admin.post('/api/schools', { code: 'EIT', name: "École d'Ingénieurs", directorName: 'Dr Directeur' })).body.school.id;
  const levelId = (await admin.post(`/api/schools/${schoolId}/levels`, { code: 'L1', name: 'Licence 1', cycle: 'LICENCE' })).body.level.id;
  const yearId = (await admin.post('/api/academic-years', { label: '2026-2027', startDate: '2026-09-01', endDate: '2027-07-31' })).body.academicYear.id;
  const s = (await admin.post('/api/students', {
    firstName: 'Awa', lastName: 'Diallo', gender: 'F', birthDate: '2005-03-15', birthPlace: 'Dakar', nationality: 'Sénégalaise',
    schoolId, enrollment: { academicYearId: yearId, levelId },
  })).body.student;
  studentId = s.id;
  enrollmentId = s.currentEnrollment.id;
});

describe('émission', () => {
  it('renvoie un PDF numéroté séquentiellement et l’enregistre', async () => {
    const r1 = await issue(studentId, '2026-2027', '&purpose=Demande de bourse');
    expect(r1.status).toBe(200);
    expect(r1.headers['content-type']).toBe('application/pdf');
    expect((r1.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect(r1.headers['x-document-reference']).toBe('CS-2026-00001');

    const r2 = await issue();
    expect(r2.headers['x-document-reference']).toBe('CS-2026-00002');

    const certs = await prisma.certificate.findMany({ orderBy: { orderNumber: 'asc' } });
    expect(certs.map((c) => c.orderNumber)).toEqual([1, 2]);
    expect(certs[0]).toMatchObject({ purpose: 'Demande de bourse', status: 'VALIDE', studentId, enrollmentId });
    expect(certs[0]!.verificationCode).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    expect((certs[0]!.snapshot as { student: { lastName: string } }).student.lastName).toBe('Diallo');
  }, 30_000);

  it('aperçu HTML : contenu correct, rien d’enregistré, aucun numéro consommé', async () => {
    const res = await admin.get(`/api/students/${studentId}/certificate?year=2026-2027&format=html`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('CERTIFICAT DE SCOLARITÉ');
    expect(res.text).toContain('Mme DIALLO Awa');
    expect(res.text).toContain('régulièrement inscrite');
    expect(res.text).toContain('Licence 1');
    expect(res.text).toContain('APERÇU');
    expect(await prisma.certificate.count()).toBe(0);
    const r = await issue();
    expect(r.headers['x-document-reference']).toBe('CS-2026-00001');
  }, 30_000);

  it('refuse une inscription annulée ou en attente, un étudiant exclu, une année inconnue', async () => {
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: 'ANNULE' } });
    expect((await admin.get(`/api/students/${studentId}/certificate?year=2026-2027`)).status).toBe(400);
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: 'INSCRIT' } });
    await prisma.student.update({ where: { id: studentId }, data: { status: 'EXCLU' } });
    const ex = await admin.get(`/api/students/${studentId}/certificate?year=2026-2027`);
    expect(ex.status).toBe(400);
    expect(ex.body.error.message).toContain('exclu');
    expect((await admin.get(`/api/students/${studentId}/certificate?year=2030-2031`)).status).toBe(404);
  });

  it('SCOLARITE d’une autre école refusé ; ENSEIGNANT refusé', async () => {
    const other = (await admin.post('/api/schools', { code: 'ESC', name: 'ESC' })).body.school.id;
    await createUser('SCOLARITE', 'sco@t.local', { schoolId: other });
    expect((await as((await loginAs('sco@t.local')).token).get(`/api/students/${studentId}/certificate?year=2026-2027`)).status).toBe(403);
    await createUser('ENSEIGNANT', 'prof@t.local');
    expect((await as((await loginAs('prof@t.local')).token).get(`/api/students/${studentId}/certificate?year=2026-2027`)).status).toBe(403);
  });
});

describe('historique, duplicata, annulation, vérification', () => {
  it('liste avec recherche ; duplicata identique (même numéro)', async () => {
    await issue(studentId, '2026-2027', '&purpose=Stage');
    const list = (await admin.get('/api/certificates?search=diallo')).body;
    expect(list.total).toBe(1);
    expect(list.data[0]).toMatchObject({ number: 'CS-2026-00001', purpose: 'Stage', level: 'L1 — Licence 1', academicYear: '2026-2027', status: 'VALIDE' });

    const dup = await binary(request(app).get(`/api/certificates/${list.data[0].id}/pdf`).set('Authorization', `Bearer ${token}`));
    expect(dup.status).toBe(200);
    expect((dup.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect(await prisma.certificate.count()).toBe(1); // pas de nouveau numéro
  }, 30_000);

  it('vérification publique SANS connexion, puis annulation visible', async () => {
    await issue();
    const cert = await prisma.certificate.findFirstOrThrow();
    const ok = await request(app).get(`/api/public/verify/${cert.verificationCode}`);
    expect(ok.status).toBe(200);
    expect(ok.body.result).toMatchObject({
      valid: true, type: 'CERTIFICAT_SCOLARITE', reference: 'CS-2026-00001',
      student: { fullName: 'DIALLO Awa', matricule: 'EIT-2026-00001' }, academicYear: '2026-2027',
    });
    expect(ok.body.result.student.birthDate).toBeUndefined(); // données minimales

    expect((await admin.post(`/api/certificates/${cert.id}/revoke`, { reason: 'x' })).status).toBe(400);
    const rev = await admin.post(`/api/certificates/${cert.id}/revoke`, { reason: 'Émis par erreur' });
    expect(rev.body.certificate).toMatchObject({ status: 'ANNULE', revokedReason: 'Émis par erreur' });
    const after = await request(app).get(`/api/public/verify/${cert.verificationCode}`);
    expect(after.body.result).toMatchObject({ valid: false, status: 'ANNULE' });
    expect((await admin.post(`/api/certificates/${cert.id}/revoke`, { reason: 'Encore' })).status).toBe(400);
  }, 30_000);

  it('code inconnu → 404 ; code mal formé → 400', async () => {
    expect((await request(app).get('/api/public/verify/ABCDEFGHJK')).status).toBe(404);
    expect((await request(app).get('/api/public/verify/abc')).status).toBe(400);
  });
});

describe('non-régression : routeurs montés sur /api', () => {
  it('une route inconnue renvoie 404 (et non 401)', async () => {
    expect((await request(app).get('/api/route-inexistante')).status).toBe(404);
  });
  it('la santé du serveur reste publique', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});
