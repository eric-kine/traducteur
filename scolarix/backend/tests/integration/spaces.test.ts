import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../../src/config/prisma';
import { app, as, createUser, loginAs, resetDb } from '../helpers';

let admin: ReturnType<typeof as>;
let schoolId: string;
let levelId: string;
let yearId: string;
let ue1: string;
let ue2: string;
let awa: string;
let moussa: string;
let fall: string;
let ba: string;

const bin = (url: string, token: string) => request(app).get(url).set('Authorization', `Bearer ${token}`).buffer(true)
  .parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d: Buffer) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });

beforeEach(async () => {
  await resetDb();
  await createUser('ADMIN', 'admin@test.local');
  admin = as((await loginAs('admin@test.local')).token);
  await prisma.institute.create({ data: { name: 'Institut Test', city: 'Dakar' } });
  schoolId = (await admin.post('/api/schools', { code: 'EIT', name: 'EIT' })).body.school.id;
  levelId = (await admin.post(`/api/schools/${schoolId}/levels`, { code: 'L1', name: 'Licence 1', cycle: 'LICENCE' })).body.level.id;
  yearId = (await admin.post('/api/academic-years', { label: '2026-2027', startDate: '2026-09-01', endDate: '2027-07-31' })).body.academicYear.id;
  const mk = async (code: string) => (await admin.post(`/api/levels/${levelId}/teaching-units`, { code, title: code, semester: 1, credits: 5, coefficient: 1, cmHours: 28, tdHours: 0 })).body.teachingUnit.id;
  ue1 = await mk('INF101'); ue2 = await mk('MAT101');
  const st = async (firstName: string, email: string) => (await admin.post('/api/students', { firstName, lastName: 'Test', gender: 'F', birthDate: '2005-01-01', birthPlace: 'Dakar', email, schoolId, enrollment: { academicYearId: yearId, levelId } })).body.student.id;
  awa = await st('Awa', 'awa@t.local'); moussa = await st('Moussa', 'moussa@t.local');
  fall = (await admin.post('/api/teachers', { firstName: 'Ousmane', lastName: 'Fall', email: 'fall@t.local', status: 'PERMANENT', hourlyRate: 10000 })).body.teacher.id;
  ba = (await admin.post('/api/teachers', { firstName: 'Aïcha', lastName: 'Ba', email: 'ba@t.local', status: 'VACATAIRE' })).body.teacher.id;
  await admin.post('/api/assignments', { teacherId: fall, teachingUnitId: ue1, academicYearId: yearId, sessionType: 'CM', assignedHours: 28, isCoordinator: true });
  await admin.post('/api/assignments', { teacherId: ba, teachingUnitId: ue2, academicYearId: yearId, sessionType: 'CM', assignedHours: 28 });
});

/** Crée le compte puis se connecte avec le mot de passe provisoire. */
async function accountFor(kind: 'teachers' | 'students', id: string) {
  const r = await admin.post(`/api/${kind}/${id}/account`, {});
  expect(r.status).toBe(201);
  return { ...(await loginAs(r.body.user.email, r.body.temporaryPassword)), body: r.body };
}

describe('comptes reliés aux fiches', () => {
  it('crée le compte ENSEIGNANT avec un mot de passe provisoire ; refuse un 2e compte', async () => {
    const r = await admin.post(`/api/teachers/${fall}/account`, {});
    expect(r.status).toBe(201);
    expect(r.body.user).toMatchObject({ email: 'fall@t.local', role: 'ENSEIGNANT' });
    expect(r.body.temporaryPassword).toMatch(/^Scx-[A-Z2-9]{4}-[A-Z2-9]{4}7$/);
    expect((await admin.get(`/api/teachers/${fall}/account`)).body.user.email).toBe('fall@t.local');
    expect((await admin.post(`/api/teachers/${fall}/account`, {})).status).toBe(409);
    await expect(loginAs('fall@t.local', r.body.temporaryPassword)).resolves.toBeTruthy();
  });

  it('étudiant : email requis ; relie un compte ETUDIANT existant ; refuse un compte d’un autre rôle', async () => {
    const noEmail = (await admin.post('/api/students', { firstName: 'Sans', lastName: 'Mail', gender: 'M', birthDate: '2005-01-01', birthPlace: 'X', schoolId })).body.student.id;
    expect((await admin.post(`/api/students/${noEmail}/account`, {})).status).toBe(400);
    expect((await admin.post(`/api/students/${noEmail}/account`, { email: 'sans.mail@t.local' })).status).toBe(201);

    await createUser('ETUDIANT', 'moussa@t.local');
    const linked = await admin.post(`/api/students/${moussa}/account`, {});
    expect(linked.body).toMatchObject({ linkedExisting: true, temporaryPassword: null });

    await createUser('SCOLARITE', 'awa@t.local');
    expect((await admin.post(`/api/students/${awa}/account`, {})).status).toBe(409);
  });
});

describe('espace étudiant', () => {
  it('voit ses inscriptions, ses notes provisoires ; relevé officiel seulement après délibération', async () => {
    const { token } = await accountFor('students', awa);
    const me = as(token);
    const space = (await me.get('/api/me/student')).body.space;
    expect(space.student.firstName).toBe('Awa');
    expect(space.enrollments[0]).toMatchObject({ academicYear: { label: '2026-2027' }, deliberated: false });

    await admin.put(`/api/teaching-units/${ue1}/grades`, {
      academicYearId: yearId, session: 'NORMALE', grades: [{ enrollmentId: space.enrollments[0].id, ccScore: 14, examScore: 14 }],
    });
    const res = (await me.get('/api/me/results?year=2026-2027')).body.results;
    expect(res.deliberatedAt).toBeNull();
    expect(res.semesters[0].units.find((u: { code: string }) => u.code === 'INF101').final).toBe(14);
    expect((await me.get('/api/me/transcript?year=2026-2027')).status).toBe(403);

    // délibération (avec toutes les notes)
    const moussaEnr = (await prisma.enrollment.findFirstOrThrow({ where: { studentId: moussa } })).id;
    for (const ue of [ue1, ue2]) {
      await admin.put(`/api/teaching-units/${ue}/grades`, { academicYearId: yearId, grades: [
        { enrollmentId: space.enrollments[0].id, ccScore: 14, examScore: 14 }, { enrollmentId: moussaEnr, ccScore: 8, examScore: 8 },
      ] });
    }
    expect((await admin.post(`/api/levels/${levelId}/deliberation`, { academicYearId: yearId })).status).toBe(200);
    const pdf = await bin('/api/me/transcript?year=2026-2027', token);
    expect(pdf.status).toBe(200);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  }, 40_000);

  it('certificat en libre-service : 2e demande dans les 24 h → même certificat (pas de nouveau numéro)', async () => {
    const { token } = await accountFor('students', awa);
    const a = await bin('/api/me/certificate?year=2026-2027', token);
    expect(a.status).toBe(200);
    expect(a.headers['x-reused']).toBe('false');
    const b = await bin('/api/me/certificate?year=2026-2027', token);
    expect(b.headers['x-reused']).toBe('true');
    expect(b.headers['x-document-reference']).toBe(a.headers['x-document-reference']);
    expect(await prisma.certificate.count()).toBe(1);
    const list = (await as(token).get('/api/me/certificates')).body.data;
    expect(list).toHaveLength(1);
    expect((await bin(`/api/me/certificates/${list[0].id}/pdf`, token)).status).toBe(200);
  }, 40_000);

  it('isolation : un étudiant n’accède à rien d’autre que ses données', async () => {
    const { token } = await accountFor('students', awa);
    const me = as(token);
    for (const url of ['/api/students', `/api/students/${moussa}`, `/api/students/${moussa}/transcript?year=2026-2027`, '/api/dashboard', '/api/users', `/api/teaching-units/${ue1}/grades?academicYearId=${yearId}`, '/api/me/teacher']) {
      expect((await me.get(url)).status, url).toBe(403);
    }
    // le certificat d'un autre étudiant n'est pas accessible
    await admin.get(`/api/students/${moussa}/certificate?year=2026-2027`);
    const other = await prisma.certificate.findFirstOrThrow({ where: { studentId: moussa } });
    expect((await me.get(`/api/me/certificates/${other.id}/pdf`)).status).toBe(404);
  }, 40_000);

  it('emploi du temps : seulement s’il est publié', async () => {
    const { token } = await accountFor('students', awa);
    await admin.post('/api/rooms', { code: 'A', capacity: 100, supportedTypes: ['CM'] });
    const t = (await admin.post('/api/schedules/generate', { levelId, academicYearId: yearId, semester: 1 })).body.timetable;
    expect((await as(token).get('/api/me/timetable?semester=1')).body.timetable).toBeNull();
    await admin.patch(`/api/schedules/${t.schedule.id}`, { status: 'PUBLIE' });
    expect((await as(token).get('/api/me/timetable?semester=1')).body.timetable.sessions).toHaveLength(2);
  });
});

describe('espace enseignant', () => {
  it('ses UE, ses étudiants, son service ; saisie des notes de SES UE seulement', async () => {
    const { token } = await accountFor('teachers', fall);
    const me = as(token);
    const space = (await me.get('/api/me/teacher')).body.space;
    expect(space.courses).toHaveLength(1);
    expect(space.courses[0]).toMatchObject({ teachingUnit: { code: 'INF101' }, isCoordinator: true, students: 2, gradesEntered: 0, assignedHours: 28 });
    expect(space.service.assignedTotal).toBe(28);

    const course = (await me.get(`/api/me/teacher/courses/${ue1}/students?academicYearId=${yearId}`)).body.course;
    expect(course.students.map((s: { firstName: string }) => s.firstName).sort()).toEqual(['Awa', 'Moussa']);
    expect((await me.get(`/api/me/teacher/courses/${ue2}/students?academicYearId=${yearId}`)).status).toBe(403);

    const enr = (await prisma.enrollment.findMany()).map((e) => e.id);
    expect((await me.put(`/api/teaching-units/${ue1}/grades`, { academicYearId: yearId, grades: enr.map((id) => ({ enrollmentId: id, ccScore: 12, examScore: 12 })) })).status).toBe(200);
    expect((await me.put(`/api/teaching-units/${ue2}/grades`, { academicYearId: yearId, grades: enr.map((id) => ({ enrollmentId: id, ccScore: 12, examScore: 12 })) })).status).toBe(403);
    expect((await me.get('/api/me/teacher')).body.space.courses[0].gradesEntered).toBe(2);

    // syllabus : responsable → peut rédiger
    expect((await me.put(`/api/ues/${ue1}/syllabus`, { year: '2026-2027', teachingMethods: 'Cours' })).status).toBe(200);
    expect((await me.get('/api/students')).status).toBe(403);
    expect((await me.get('/api/me/student')).status).toBe(403);
  });

  it('compte enseignant sans fiche reliée → message clair', async () => {
    await createUser('ENSEIGNANT', 'orphelin@t.local');
    const r = await as((await loginAs('orphelin@t.local')).token).get('/api/me/teacher');
    expect(r.status).toBe(404);
    expect(r.body.error.message).toContain('Aucune fiche enseignant');
  });
});

describe('tableau de bord', () => {
  it('indicateurs et alertes', async () => {
    const d = (await admin.get('/api/dashboard')).body.dashboard;
    expect(d.academicYear.label).toBe('2026-2027');
    expect(d.kpis).toMatchObject({ schools: 1, levels: 1, students: 2, teachers: 2, teachingUnits: 2, enrollments: 2 });
    const keys = d.alerts.map((a: { key: string }) => a.key);
    expect(keys).toEqual(expect.arrayContaining(['grades_missing', 'timetables', 'no_syllabus', 'teacher_accounts', 'no_coordinator']));
    expect(d.alerts.find((a: { key: string }) => a.key === 'grades_missing').count).toBe(2);
    expect(d.bySchool[0]).toMatchObject({ code: 'EIT', students: 2, enrollments: 2, levels: 1, teachingUnits: 2 });
  });

  it('heures non affectées détectées ; SCOLARITE limitée à son école ; ENSEIGNANT refusé', async () => {
    await admin.post(`/api/levels/${levelId}/teaching-units`, { code: 'NEW', title: 'X', semester: 1, credits: 1, coefficient: 1, cmHours: 10 });
    const d = (await admin.get('/api/dashboard')).body.dashboard;
    expect(d.alerts.find((a: { key: string }) => a.key === 'uncovered_hours').items[0]).toContain('NEW CM : 0/10 h');

    const esc = (await admin.post('/api/schools', { code: 'ESC', name: 'ESC' })).body.school.id;
    await createUser('SCOLARITE', 'sco@t.local', { schoolId: esc });
    const sd = (await as((await loginAs('sco@t.local')).token).get('/api/dashboard')).body.dashboard;
    expect(sd).toMatchObject({ scope: 'ESC', kpis: { schools: 1, students: 0, enrollments: 0 } });

    await createUser('ENSEIGNANT', 'p@t.local');
    expect((await as((await loginAs('p@t.local')).token).get('/api/dashboard')).status).toBe(403);
  });
});
