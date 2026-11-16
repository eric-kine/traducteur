import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../../src/config/prisma';
import { app, as, createInstitute, createUser, loginAs, resetDb } from '../helpers';

let admin: ReturnType<typeof as>;
let token: string;
let yearId: string;
let levelId: string;
let ue1: string; // S1 : CC 40 / Examen 60, coef 2, 6 crédits
let ue2: string; // S2 : CC 40 / Examen 60, coef 1, 4 crédits
let awa: { id: string; enrollmentId: string };
let moussa: { id: string; enrollmentId: string };

const STUDENT = { gender: 'F', birthDate: '2005-03-15', birthPlace: 'Dakar' };

async function student(firstName: string, lastName: string, schoolId: string) {
  const s = (await admin.post('/api/students', { ...STUDENT, firstName, lastName, schoolId, enrollment: { academicYearId: yearId, levelId } })).body.student;
  return { id: s.id as string, enrollmentId: s.currentEnrollment.id as string };
}
const sheet = (ue: string, session = 'NORMALE') => admin.get(`/api/teaching-units/${ue}/grades?academicYearId=${yearId}&session=${session}`);
const save = (ue: string, grades: object[], session = 'NORMALE', who = admin) => who.put(`/api/teaching-units/${ue}/grades`, { academicYearId: yearId, session, grades });

beforeEach(async () => {
  await resetDb();
  await createUser('ADMIN', 'admin@test.local');
  token = (await loginAs('admin@test.local')).token;
  admin = as(token);
  await prisma.institute.create({ data: { name: 'Institut Test', city: 'Dakar', directorName: 'Pr Test' } });
  const schoolId = (await admin.post('/api/schools', { code: 'EIT', name: 'EIT', directorName: 'Dr Directeur' })).body.school.id;
  levelId = (await admin.post(`/api/schools/${schoolId}/levels`, { code: 'L1', name: 'Licence 1', cycle: 'LICENCE' })).body.level.id;
  yearId = (await admin.post('/api/academic-years', { label: '2026-2027', startDate: '2026-09-01', endDate: '2027-07-31' })).body.academicYear.id;
  const base = { cmHours: 20, tdHours: 10, ccWeight: 40, examWeight: 60, tpWeight: 0 };
  ue1 = (await admin.post(`/api/levels/${levelId}/teaching-units`, { ...base, code: 'INF101', title: 'Algorithmique', semester: 1, credits: 6, coefficient: 2 })).body.teachingUnit.id;
  ue2 = (await admin.post(`/api/levels/${levelId}/teaching-units`, { ...base, code: 'MAT201', title: 'Mathématiques', semester: 2, credits: 4, coefficient: 1 })).body.teachingUnit.id;
  awa = await student('Awa', 'Diallo', schoolId);
  moussa = await student('Moussa', 'Sarr', schoolId);
});

describe('feuille de notes', () => {
  it('liste les inscrits et calcule la note finale côté serveur', async () => {
    expect((await sheet(ue1)).body.sheet.rows).toHaveLength(2);
    const res = await save(ue1, [
      { enrollmentId: awa.enrollmentId, ccScore: 14, examScore: 12, finalScore: 20 },
      { enrollmentId: moussa.enrollmentId, ccScore: 8, isAbsent: true },
    ]);
    expect(res.status).toBe(200);
    const rows = res.body.sheet.rows;
    expect(rows.find((r: { enrollmentId: string }) => r.enrollmentId === awa.enrollmentId).finalScore).toBe(12.8); // 14×0,4 + 12×0,6 (finalScore envoyé ignoré)
    expect(rows.find((r: { enrollmentId: string }) => r.enrollmentId === moussa.enrollmentId).finalScore).toBe(3.2); // absent : 8×0,4
  });

  it('valide les notes (0 à 20) et refuse une inscription étrangère', async () => {
    expect((await save(ue1, [{ enrollmentId: awa.enrollmentId, ccScore: 21 }])).status).toBe(400);
    expect((await save(ue1, [{ enrollmentId: '00000000-0000-4000-8000-000000000000', ccScore: 10 }])).status).toBe(400);
  });

  it('rattrapage : seuls les étudiants sous 10 ; CC conservé', async () => {
    await save(ue1, [
      { enrollmentId: awa.enrollmentId, ccScore: 14, examScore: 12 },
      { enrollmentId: moussa.enrollmentId, ccScore: 12, examScore: 6 }, // 8,4
    ]);
    const r = (await sheet(ue1, 'RATTRAPAGE')).body.sheet;
    expect(r.rows.map((x: { enrollmentId: string }) => x.enrollmentId)).toEqual([moussa.enrollmentId]);
    expect(r.rows[0].normal).toMatchObject({ ccScore: 12, finalScore: 8.4 });

    const saved = await save(ue1, [{ enrollmentId: moussa.enrollmentId, examScore: 11 }], 'RATTRAPAGE');
    expect(saved.body.sheet.rows[0].finalScore).toBe(11.4); // 12×0,4 + 11×0,6
  });

  it('un enseignant affecté à l’UE peut saisir ; un autre non', async () => {
    const prof = await createUser('ENSEIGNANT', 'prof@t.local');
    const t = await prisma.teacher.create({ data: { employeeNumber: 'ENS-1', firstName: 'A', lastName: 'B', email: 'prof@t.local', status: 'VACATAIRE', userId: prof.id } });
    await prisma.teachingAssignment.create({ data: { teacherId: t.id, teachingUnitId: ue1, academicYearId: yearId, sessionType: 'CM', assignedHours: 10 } });
    const p = as((await loginAs('prof@t.local')).token);
    expect((await save(ue1, [{ enrollmentId: awa.enrollmentId, ccScore: 10, examScore: 10 }], 'NORMALE', p)).status).toBe(200);
    expect((await save(ue2, [{ enrollmentId: awa.enrollmentId, ccScore: 10, examScore: 10 }], 'NORMALE', p)).status).toBe(403);
    expect((await p.get(`/api/teaching-units/${ue2}/grades?academicYearId=${yearId}`)).status).toBe(403);
  });
});

describe('résultats, délibération et relevé', () => {
  async function fillAll() {
    await save(ue1, [
      { enrollmentId: awa.enrollmentId, ccScore: 16, examScore: 15 }, // 15,4
      { enrollmentId: moussa.enrollmentId, ccScore: 10, examScore: 6 }, // 7,6
    ]);
    await save(ue2, [
      { enrollmentId: awa.enrollmentId, ccScore: 14, examScore: 14 }, // 14
      { enrollmentId: moussa.enrollmentId, ccScore: 3, examScore: 3 }, // 3 → éliminatoire
    ]);
  }

  it('calcule moyennes, crédits, décision et mention', async () => {
    await fillAll();
    const rows = (await admin.get(`/api/levels/${levelId}/results?academicYearId=${yearId}`)).body.data;
    const a = rows.find((r: { enrollmentId: string }) => r.enrollmentId === awa.enrollmentId);
    expect(a.year).toMatchObject({ average: 14.93, creditsEarned: 10, totalCredits: 10, decision: 'ADMIS', mention: 'Bien' }); // (15,4×2 + 14)/3
    const m = rows.find((r: { enrollmentId: string }) => r.enrollmentId === moussa.enrollmentId);
    expect(m.year).toMatchObject({ decision: 'AJOURNE', creditsEarned: 0, mention: null });
  });

  it('refuse la délibération si des notes manquent', async () => {
    await save(ue1, [{ enrollmentId: awa.enrollmentId, ccScore: 16, examScore: 15 }]);
    const res = await admin.post(`/api/levels/${levelId}/deliberation`, { academicYearId: yearId });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Notes manquantes');
  });

  it('délibère : résultats figés, notes verrouillées ; réouverture par l’admin', async () => {
    await fillAll();
    const d = await admin.post(`/api/levels/${levelId}/deliberation`, { academicYearId: yearId });
    expect(d.body).toEqual({ deliberated: 2, admitted: 1 });
    const e = await prisma.enrollment.findUniqueOrThrow({ where: { id: awa.enrollmentId } });
    expect(e).toMatchObject({ decision: 'ADMIS', mention: 'Bien', creditsEarned: 10, status: 'ADMIS' });
    expect(e.finalAverage?.toNumber()).toBe(14.93);
    expect((await sheet(ue1)).body.sheet).toMatchObject({ locked: true, canEdit: false });
    expect((await save(ue1, [{ enrollmentId: awa.enrollmentId, ccScore: 1, examScore: 1 }])).status).toBe(409);

    expect((await admin.post(`/api/levels/${levelId}/deliberation/reopen`, { academicYearId: yearId })).status).toBe(200);
    expect((await save(ue1, [{ enrollmentId: awa.enrollmentId, ccScore: 16, examScore: 16 }])).status).toBe(200);
  });

  it('GET /students/:id/transcript?year=… renvoie un PDF et l’enregistre au registre', async () => {
    await fillAll();
    await admin.post(`/api/levels/${levelId}/deliberation`, { academicYearId: yearId });
    const res = await request(app).get(`/api/students/${awa.id}/transcript?year=2026-2027`).set('Authorization', `Bearer ${token}`)
      .buffer(true).parse((r, cb) => { const chunks: Buffer[] = []; r.on('data', (c: Buffer) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.headers['x-document-reference']).toBe('RN-2026-000001');

    const doc = await prisma.generatedDocument.findUniqueOrThrow({ where: { reference: 'RN-2026-000001' } });
    expect(doc).toMatchObject({ type: 'RELEVE_NOTES', studentId: awa.id, enrollmentId: awa.enrollmentId });
    expect((doc.snapshot as { year: { decision: string } }).year.decision).toBe('ADMIS');
  }, 30_000);

  it('format=html : aperçu (contenu échappé, mention provisoire avant délibération)', async () => {
    await prisma.student.update({ where: { id: awa.id }, data: { lastName: '<script>alert(1)</script>' } });
    await fillAll();
    const res = await admin.get(`/api/students/${awa.id}/transcript?year=2026-2027&format=html`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('RELEVÉ DE NOTES');
    expect(res.text).toContain('PROVISOIRE');
    expect(res.text).toContain('&lt;SCRIPT&gt;');
    expect(res.text).not.toContain('<script>');
    expect(await prisma.generatedDocument.count()).toBe(0); // un aperçu n'est pas un document émis
  });

  it('404 pour une année sans inscription ; 400 pour un format d’année invalide', async () => {
    expect((await admin.get(`/api/students/${awa.id}/transcript?year=2030-2031`)).status).toBe(404);
    expect((await admin.get(`/api/students/${awa.id}/transcript?year=2026`)).status).toBe(400);
  });
});
