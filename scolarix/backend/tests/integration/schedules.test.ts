import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../../src/config/prisma';
import { app, as, createUser, loginAs, resetDb } from '../helpers';

let admin: ReturnType<typeof as>;
let token: string;
let schoolId: string;
let l1: string;
let l2: string;
let yearId: string;
let gl: string;
let rt: string;
let fall: string; // enseignant partagé entre L1 et L2

const ue = async (levelId: string, code: string, h: { cm?: number; td?: number; tp?: number }, specialtyId?: string) =>
  (await admin.post(`/api/levels/${levelId}/teaching-units`, { code, title: code, semester: 1, credits: 3, coefficient: 1, cmHours: h.cm ?? 0, tdHours: h.td ?? 0, tpHours: h.tp ?? 0, specialtyId })).body.teachingUnit.id as string;
const assign = (teacherId: string, teachingUnitId: string, sessionType: string, assignedHours: number) =>
  admin.post('/api/assignments', { teacherId, teachingUnitId, academicYearId: yearId, sessionType, assignedHours });
const generate = (levelId: string, weeks = 14) => admin.post('/api/schedules/generate', { levelId, academicYearId: yearId, semester: 1, weeks });

beforeEach(async () => {
  await resetDb();
  await createUser('ADMIN', 'admin@test.local');
  token = (await loginAs('admin@test.local')).token;
  admin = as(token);
  await prisma.institute.create({ data: { name: 'Institut Test' } });
  schoolId = (await admin.post('/api/schools', { code: 'EIT', name: 'EIT' })).body.school.id;
  l1 = (await admin.post(`/api/schools/${schoolId}/levels`, { code: 'L1', name: 'Licence 1', cycle: 'LICENCE' })).body.level.id;
  l2 = (await admin.post(`/api/schools/${schoolId}/levels`, { code: 'L2', name: 'Licence 2', cycle: 'LICENCE' })).body.level.id;
  gl = (await admin.post(`/api/schools/${schoolId}/specialties`, { code: 'GL', name: 'GL' })).body.specialty.id;
  rt = (await admin.post(`/api/schools/${schoolId}/specialties`, { code: 'RT', name: 'RT' })).body.specialty.id;
  yearId = (await admin.post('/api/academic-years', { label: '2026-2027', startDate: '2026-09-01', endDate: '2027-07-31' })).body.academicYear.id;
  fall = (await admin.post('/api/teachers', { firstName: 'Ousmane', lastName: 'Fall', email: 'fall@t.local', status: 'PERMANENT' })).body.teacher.id;
  await admin.post('/api/rooms', { code: 'AMPHI', capacity: 200, supportedTypes: ['CM', 'TD'] });
  await admin.post('/api/rooms', { code: 'B12', capacity: 40, supportedTypes: ['TD'] });
  await admin.post('/api/rooms', { code: 'LAB1', capacity: 30, supportedTypes: ['TP'] });
});

describe('salles et créneaux', () => {
  it('grille par défaut 08-10, 10-12, 14-16, 16-18 ; modification avec contrôle des chevauchements', async () => {
    const d = (await admin.get('/api/timeslots')).body.data;
    expect(d.map((s: { startTime: string; endTime: string }) => `${s.startTime}-${s.endTime}`)).toEqual(['08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00']);
    expect((await admin.put('/api/timeslots', { slots: [{ startTime: '08:00', endTime: '10:30' }, { startTime: '10:00', endTime: '12:00' }] })).status).toBe(400);
  });
  it('CRUD salles, code unique', async () => {
    expect((await admin.get('/api/rooms')).body.data).toHaveLength(3);
    expect((await admin.post('/api/rooms', { code: 'amphi', capacity: 10, supportedTypes: ['CM'] })).status).toBe(409);
    expect((await admin.post('/api/rooms', { code: 'X', capacity: 0, supportedTypes: [] })).status).toBe(400);
  });
});

describe('génération', () => {
  it('place toutes les séances sans conflit, d’après les volumes et les affectations', async () => {
    const algo = await ue(l1, 'INF101', { cm: 30, td: 14 }); // CM : ⌈30/28⌉ = 2 séances ; TD : 1
    const web = await ue(l1, 'GL101', { tp: 28 }, gl); // TP GL : 1 séance
    const net = await ue(l1, 'RT101', { tp: 28 }, rt); // TP RT : 1 séance
    await assign(fall, algo, 'CM', 30);
    await assign(fall, algo, 'TD', 14);
    const res = await generate(l1);
    expect(res.status).toBe(200);
    const t = res.body.timetable;
    expect(t.schedule.report).toMatchObject({ total: 5, placed: 5, unplaced: [] });
    expect(t.schedule.report.coverage).toContainEqual({ teachingUnit: 'INF101', sessionType: 'CM', quotaHours: 30, weeklySessions: 2, plannedHours: 56 });
    expect(t.sessions).toHaveLength(5);
    // Contraintes : CM en amphi, TP en labo, pas de conflit enseignant
    const rooms = Object.fromEntries((await admin.get('/api/rooms')).body.data.map((r: { id: string; code: string }) => [r.id, r.code]));
    for (const s of t.sessions) {
      if (s.sessionType === 'TP') expect(rooms[s.room.id]).toBe('LAB1');
      if (s.sessionType === 'CM') expect(rooms[s.room.id]).toBe('AMPHI');
    }
    const fallCells = t.sessions.filter((s: { teacher: { id: string } | null }) => s.teacher?.id === fall).map((s: { day: string; timeslotId: string }) => `${s.day}|${s.timeslotId}`);
    expect(new Set(fallCells).size).toBe(fallCells.length);
    // GL et RT n'ont qu'une salle de TP : jamais au même moment
    const tp = t.sessions.filter((s: { sessionType: string }) => s.sessionType === 'TP');
    expect(`${tp[0].day}|${tp[0].timeslotId}`).not.toBe(`${tp[1].day}|${tp[1].timeslotId}`);
    void web; void net;
  });

  it('un enseignant partagé entre deux niveaux n’est jamais placé deux fois au même moment', async () => {
    const a = await ue(l1, 'A1', { cm: 28 * 3 }); // 3 séances
    const b = await ue(l2, 'B1', { cm: 28 * 3 });
    await assign(fall, a, 'CM', 84);
    await assign(fall, b, 'CM', 84);
    await prisma.teacher.update({ where: { id: fall }, data: { unavailability: [{ day: 'LUNDI', start: '08:00' }] } });
    await generate(l1);
    await generate(l2);
    const v = (await admin.get(`/api/timetables/teacher/${fall}?academicYearId=${yearId}&semester=1`)).body.timetable;
    expect(v.sessions).toHaveLength(6);
    const cells = v.sessions.map((s: { day: string; timeslotId: string }) => `${s.day}|${s.timeslotId}`);
    expect(new Set(cells).size).toBe(6);
    const lundi8 = (await prisma.timeslot.findFirstOrThrow({ where: { startTime: '08:00' } })).id;
    expect(cells).not.toContain(`LUNDI|${lundi8}`);
  });

  it('séance impossible → rapport avec la raison ; sans enseignant → avertissement', async () => {
    await ue(l1, 'BIG', { tp: 28 });
    await prisma.enrollment.createMany({ data: [] });
    // 31 étudiants inscrits > LAB1 (30 places)
    const level = l1;
    for (let i = 0; i < 31; i++) {
      await prisma.student.create({ data: { matricule: `M${i}`, firstName: 'E', lastName: `${i}`, gender: 'F', birthDate: new Date('2005-01-01'), birthPlace: 'X', schoolId, enrollments: { create: { academicYearId: yearId, levelId: level, status: 'INSCRIT' } } } });
    }
    const r = (await generate(l1)).body.timetable.schedule.report;
    expect(r.placed).toBe(0);
    expect(r.unplaced[0]).toMatchObject({ teachingUnit: 'BIG', sessionType: 'TP' });
    expect(r.unplaced[0].reason).toContain('aucune salle ne convient');
    expect(r.warnings.join(' ')).toContain('aucun enseignant affecté');
  });

  it('régénérer conserve les séances épinglées', async () => {
    const a = await ue(l1, 'A1', { cm: 56 }); // 2 séances
    await assign(fall, a, 'CM', 56);
    const t = (await generate(l1)).body.timetable;
    const slots = (await admin.get('/api/timeslots')).body.data;
    const target = slots[3].id; // 16:00
    const moved = await admin.patch(`/api/schedule-sessions/${t.sessions[0].id}`, { day: 'SAMEDI', timeslotId: target });
    expect(moved.status).toBe(200);
    const again = (await generate(l1)).body.timetable;
    expect(again.sessions).toHaveLength(2);
    expect(again.sessions.find((s: { locked: boolean }) => s.locked)).toMatchObject({ day: 'SAMEDI', timeslotId: target });
  });
});

describe('modifications manuelles', () => {
  it('refuse un déplacement en conflit (niveau, enseignant, salle, indisponibilité)', async () => {
    const a = await ue(l1, 'A1', { cm: 28 });
    const b = await ue(l1, 'B1', { cm: 28 });
    const c = await ue(l2, 'C1', { cm: 28 });
    await assign(fall, a, 'CM', 28);
    await assign(fall, c, 'CM', 28);
    const t1 = (await generate(l1)).body.timetable;
    const t2 = (await generate(l2)).body.timetable;
    const sa = t1.sessions.find((s: { teachingUnit: { id: string } }) => s.teachingUnit.id === a);
    const sb = t1.sessions.find((s: { teachingUnit: { id: string } }) => s.teachingUnit.id === b);
    const sc = t2.sessions[0];

    const lvl = await admin.patch(`/api/schedule-sessions/${sa.id}`, { day: sb.day, timeslotId: sb.timeslotId });
    expect(lvl.status).toBe(409);
    expect(lvl.body.error.message).toContain('Le niveau a déjà B1');

    const prof = await admin.patch(`/api/schedule-sessions/${sa.id}`, { day: sc.day, timeslotId: sc.timeslotId, roomId: null });
    expect(prof.status).toBe(409);
    expect(prof.body.error.message).toContain('enseigne déjà C1');

    const room = await admin.patch(`/api/schedule-sessions/${sb.id}`, { day: sc.day, timeslotId: sc.timeslotId });
    expect(room.status).toBe(409);
    expect(room.body.error.message).toContain('est déjà prise');

    await prisma.teacher.update({ where: { id: fall }, data: { unavailability: [{ day: 'SAMEDI', start: '16:00' }] } });
    const slot16 = (await admin.get('/api/timeslots')).body.data[3].id;
    const unav = await admin.patch(`/api/schedule-sessions/${sa.id}`, { day: 'SAMEDI', timeslotId: slot16 });
    expect(unav.status).toBe(409);
    expect(unav.body.error.message).toContain('indisponible');
  });

  it('refuse de déplacer une séance dans une salle indisponible ou inadaptée', async () => {
    await ue(l1, 'A1', { cm: 28 });
    const t = (await generate(l1)).body.timetable;
    const s = t.sessions[0];
    const slot16 = (await admin.get('/api/timeslots')).body.data[3].id;
    await prisma.room.update({ where: { id: s.room.id }, data: { unavailability: [{ day: 'SAMEDI', start: '16:00' }] } });
    const res = await admin.patch(`/api/schedule-sessions/${s.id}`, { day: 'SAMEDI', timeslotId: slot16 });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('indisponible');
    const lab = (await admin.get('/api/rooms')).body.data.find((r: { code: string }) => r.code === 'LAB1');
    const wrong = await admin.patch(`/api/schedule-sessions/${s.id}`, { roomId: lab.id });
    expect(wrong.status).toBe(409);
    expect(wrong.body.error.message).toContain("n'accueille pas de CM");
  });

  it('ajout et suppression manuels ; publication ; PDF niveau / enseignant / salle', async () => {
    const a = await ue(l1, 'A1', { cm: 28 });
    await assign(fall, a, 'CM', 28);
    const t = (await generate(l1)).body.timetable;
    const slots = (await admin.get('/api/timeslots')).body.data;
    const added = await admin.post(`/api/schedules/${t.schedule.id}/sessions`, { teachingUnitId: a, sessionType: 'CM', day: 'VENDREDI', timeslotId: slots[0].id, teacherId: fall });
    expect(added.status).toBe(201);
    expect(added.body.timetable.sessions).toHaveLength(2);
    const del = await admin.delete(`/api/schedule-sessions/${added.body.timetable.sessions.find((s: { day: string }) => s.day === 'VENDREDI').id}`);
    expect(del.body.timetable.sessions).toHaveLength(1);
    expect((await admin.patch(`/api/schedules/${t.schedule.id}`, { status: 'PUBLIE' })).body.timetable.schedule.status).toBe('PUBLIE');

    const bin = (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`).buffer(true)
      .parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d: Buffer) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });
    const room = t.sessions[0].room.id;
    for (const url of [`/api/schedules/${t.schedule.id}/pdf`, `/api/timetables/teacher/${fall}?academicYearId=${yearId}&semester=1&format=pdf`, `/api/timetables/room/${room}?academicYearId=${yearId}&semester=1&format=pdf`]) {
      const r = await bin(url);
      expect(r.status, url).toBe(200);
      expect((r.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    }
  }, 60_000);

  it('une salle utilisée ne peut pas être supprimée ; un créneau utilisé non plus', async () => {
    const a = await ue(l1, 'A1', { cm: 28 });
    const t = (await generate(l1)).body.timetable;
    expect((await admin.delete(`/api/rooms/${t.sessions[0].room.id}`)).status).toBe(409);
    expect((await admin.put('/api/timeslots', { slots: [{ startTime: '07:00', endTime: '08:00' }] })).status).toBe(409);
    void a;
  });

  it('droits : SCOLARITE d’une autre école ne peut pas générer ; ENSEIGNANT refusé', async () => {
    const other = (await admin.post('/api/schools', { code: 'ESC', name: 'ESC' })).body.school.id;
    await createUser('SCOLARITE', 'sco@t.local', { schoolId: other });
    const sco = as((await loginAs('sco@t.local')).token);
    await ue(l1, 'A1', { cm: 28 });
    expect((await sco.post('/api/schedules/generate', { levelId: l1, academicYearId: yearId, semester: 1 })).status).toBe(403);
    await createUser('ENSEIGNANT', 'p@t.local');
    expect((await as((await loginAs('p@t.local')).token).get('/api/rooms')).status).toBe(403);
  });
});
