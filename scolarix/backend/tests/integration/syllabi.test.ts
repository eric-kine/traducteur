import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../../src/config/prisma';
import { app, as, createUser, loginAs, resetDb } from '../helpers';

let admin: ReturnType<typeof as>;
let token: string;
let schoolId: string;
let levelId: string;
let yearId: string;
let ue1: string;
let ue2: string;

const binary = (r: request.Request) =>
  r.buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });

beforeEach(async () => {
  await resetDb();
  await createUser('ADMIN', 'admin@test.local');
  token = (await loginAs('admin@test.local')).token;
  admin = as(token);
  await prisma.institute.create({ data: { name: 'Institut Test', city: 'Dakar' } });
  schoolId = (await admin.post('/api/schools', { code: 'EIT', name: "École d'Ingénieurs" })).body.school.id;
  levelId = (await admin.post(`/api/schools/${schoolId}/levels`, { code: 'L1', name: 'Licence 1', cycle: 'LICENCE' })).body.level.id;
  yearId = (await admin.post('/api/academic-years', { label: '2026-2027', startDate: '2026-09-01', endDate: '2027-07-31' })).body.academicYear.id;
  ue1 = (await admin.post(`/api/levels/${levelId}/teaching-units`, {
    code: 'INF101', title: 'Algorithmique', semester: 1, credits: 6, coefficient: 3, cmHours: 24, tdHours: 18, tpHours: 12,
    ccWeight: 30, examWeight: 50, tpWeight: 20, objectives: 'Objectifs de l’UE', prerequisites: 'Bases de maths', bibliography: 'Cormen\nKnuth',
  })).body.teachingUnit.id;
  ue2 = (await admin.post(`/api/levels/${levelId}/teaching-units`, { code: 'MAT201', title: 'Analyse', semester: 2, credits: 4, coefficient: 1, cmHours: 20, tdHours: 10 })).body.teachingUnit.id;
});

const CONTENT = {
  year: '2026-2027', status: 'PUBLIE',
  competencies: '- Concevoir un algorithme\n- Analyser sa complexité',
  content: [
    { title: 'Introduction', sessionType: 'CM', hours: 4, description: 'Notions de base' },
    { title: 'Tris', sessionType: 'TD', hours: 6 },
  ],
  teachingMethods: 'Cours, exercices, projet',
  evaluationMethods: 'Un projet noté compte dans le CC.',
};

describe('données et enregistrement', () => {
  it('pré-remplit depuis l’UE quand le syllabus n’existe pas encore', async () => {
    const s = (await admin.get(`/api/ues/${ue1}/syllabus/data?year=2026-2027`)).body.syllabus;
    expect(s).toMatchObject({ exists: false, canEdit: true, academicYear: { label: '2026-2027' } });
    expect(s.teachingUnit).toMatchObject({ code: 'INF101', cmHours: 24, tdHours: 18, tpHours: 12, totalHours: 54, objectives: 'Objectifs de l’UE' });
    expect(s.fields.content).toEqual([]);
  });

  it('année courante par défaut ; enregistre les champs complémentaires', async () => {
    const saved = await admin.put(`/api/ues/${ue1}/syllabus`, CONTENT);
    expect(saved.status).toBe(200);
    expect(saved.body.syllabus).toMatchObject({ exists: true, status: 'PUBLIE', updatedBy: 'Test ADMIN' });
    expect(saved.body.syllabus.fields.content).toHaveLength(2);
    const again = (await admin.get(`/api/ues/${ue1}/syllabus/data`)).body.syllabus; // sans ?year → année courante
    expect(again.fields.teachingMethods).toBe('Cours, exercices, projet');
  });

  it('valide le contenu détaillé', async () => {
    const res = await admin.put(`/api/ues/${ue1}/syllabus`, { year: '2026-2027', content: [{ title: '', hours: -1, sessionType: 'XX' }] });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details)).toEqual(expect.arrayContaining(['content.0.title', 'content.0.hours', 'content.0.sessionType']));
  });

  it('le responsable de l’UE peut rédiger ; un autre enseignant non ; autre école interdite', async () => {
    for (const [email, coord] of [['coord@t.local', true], ['autre@t.local', false]] as const) {
      const u = await createUser('ENSEIGNANT', email);
      const t = await prisma.teacher.create({ data: { employeeNumber: email, firstName: 'A', lastName: email, email, status: 'VACATAIRE', userId: u.id } });
      await prisma.teachingAssignment.create({ data: { teacherId: t.id, teachingUnitId: ue1, academicYearId: yearId, sessionType: coord ? 'CM' : 'TD', assignedHours: 10, isCoordinator: coord } });
    }
    const coord = as((await loginAs('coord@t.local')).token);
    const other = as((await loginAs('autre@t.local')).token);
    expect((await coord.put(`/api/ues/${ue1}/syllabus`, CONTENT)).status).toBe(200);
    expect((await other.get(`/api/ues/${ue1}/syllabus/data`)).body.syllabus.canEdit).toBe(false);
    expect((await other.put(`/api/ues/${ue1}/syllabus`, CONTENT)).status).toBe(403);

    const esc = (await admin.post('/api/schools', { code: 'ESC', name: 'ESC' })).body.school.id;
    await createUser('SCOLARITE', 'sco@t.local', { schoolId: esc });
    expect((await as((await loginAs('sco@t.local')).token).get(`/api/ues/${ue1}/syllabus/data`)).status).toBe(403);
  });
});

describe('PDF et aperçu', () => {
  it('aperçu HTML : en-tête, volumes, responsable, contenu, évaluation générée, bibliographie, texte échappé', async () => {
    const t = await prisma.teacher.create({ data: { employeeNumber: 'E1', title: 'Dr', firstName: 'Ousmane', lastName: 'Fall', email: 'o.fall@t.local', status: 'PERMANENT' } });
    await prisma.teachingAssignment.create({ data: { teacherId: t.id, teachingUnitId: ue1, academicYearId: yearId, sessionType: 'CM', assignedHours: 24, isCoordinator: true } });
    await admin.put(`/api/ues/${ue1}/syllabus`, { ...CONTENT, teachingMethods: '<script>alert(1)</script>' });
    const res = await admin.get(`/api/ues/${ue1}/syllabus?year=2026-2027&format=html`);
    expect(res.status).toBe(200);
    for (const s of ['Institut Test', 'École d&#39;Ingénieurs', 'Licence 1', 'INF101', 'Algorithmique', '6', 'CM 24 h', 'TD 18 h', 'TP 12 h', '= 54 h',
      'Dr Ousmane FALL', 'Objectifs de l’UE', 'Concevoir un algorithme', 'Introduction', 'Contrôle continu : 30 %', 'Examen final : 50 %',
      'Travaux pratiques : 20 %', 'Un projet noté', 'Cormen', 'Knuth']) {
      expect(res.text).toContain(s);
    }
    expect(res.text).toContain('&lt;script&gt;');
    expect(res.text).not.toContain('<script>');
  });

  it('GET /api/ues/:id/syllabus renvoie un PDF', async () => {
    await admin.put(`/api/ues/${ue1}/syllabus`, CONTENT);
    const res = await binary(request(app).get(`/api/ues/${ue1}/syllabus?year=2026-2027`).set('Authorization', `Bearer ${token}`));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect((await prisma.syllabus.findFirstOrThrow()).generatedAt).not.toBeNull();
  }, 30_000);

  it('GET /api/levels/:id/syllabi renvoie un ZIP avec un PDF par UE', async () => {
    await admin.put(`/api/ues/${ue1}/syllabus`, CONTENT);
    const res = await binary(request(app).get(`/api/levels/${levelId}/syllabi?year=2026-2027`).set('Authorization', `Bearer ${token}`));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toContain('syllabus-EIT-L1-2026-2027.zip');
    const zip = res.body as Buffer;
    expect(zip.subarray(0, 2).toString()).toBe('PK');
    expect(zip.includes('S1-INF101.pdf')).toBe(true);
    expect(zip.includes('S2-MAT201.pdf')).toBe(true);
    expect(res.headers['x-syllabus-count']).toBe('2');

    // Uniquement les syllabus rédigés, et filtre par semestre
    const only = await binary(request(app).get(`/api/levels/${levelId}/syllabi?year=2026-2027&includeDrafts=false`).set('Authorization', `Bearer ${token}`));
    expect(only.headers['x-syllabus-count']).toBe('1');
    expect((await admin.get(`/api/levels/${levelId}/syllabi?year=2026-2027&semester=2&includeDrafts=false`)).status).toBe(404);
  }, 60_000);

  it('erreurs : année inconnue, UE inconnue', async () => {
    expect((await admin.get(`/api/ues/${ue1}/syllabus?year=2030-2031&format=html`)).status).toBe(404);
    expect((await admin.get('/api/ues/00000000-0000-4000-8000-000000000000/syllabus?format=html')).status).toBe(404);
    void ue2;
  });
});
