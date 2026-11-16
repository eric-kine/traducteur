import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/config/prisma';
import { as, createInstitute, createUser, loginAs, resetDb } from '../helpers';

let admin: ReturnType<typeof as>;
let schoolId: string;
let levelId: string;
let specialtyId: string;
const url = () => `/api/levels/${levelId}/teaching-units`;
const UE = { code: 'INF101', title: 'Algorithmique', semester: 1, credits: 6, coefficient: 2, cmHours: 24, tdHours: 18, tpHours: 12 };

beforeEach(async () => {
  await resetDb();
  await createUser('ADMIN', 'admin@test.local');
  admin = as((await loginAs('admin@test.local')).token);
  await createInstitute();
  schoolId = (await admin.post('/api/schools', { code: 'EIT', name: 'EIT' })).body.school.id;
  levelId = (await admin.post(`/api/schools/${schoolId}/levels`, { code: 'L1', name: 'Licence 1', cycle: 'LICENCE' })).body.level.id;
  specialtyId = (await admin.post(`/api/schools/${schoolId}/specialties`, { code: 'GL', name: 'Génie Logiciel' })).body.specialty.id;
});

describe('création et calculs', () => {
  it('calcule le total et le volume payé (équivalent TD) côté serveur', async () => {
    const res = await admin.post(url(), { ...UE, hourlyRate: 10000 });
    expect(res.status).toBe(201);
    expect(res.body.teachingUnit).toMatchObject({
      code: 'INF101',
      totalHours: 54, // 24 + 18 + 12
      paidHours: 66, // 24×1,5 + 18 + 12
      paidHoursAuto: true,
      hourlyRate: 10000,
      estimatedCost: 660000,
      coefficient: 2,
      specialtyId: null, // tronc commun
    });
  });

  it('ignore un totalHours envoyé par le client', async () => {
    const res = await admin.post(url(), { ...UE, totalHours: 999 });
    expect(res.body.teachingUnit.totalHours).toBe(54);
  });

  it('accepte un volume payé saisi à la main', async () => {
    const res = await admin.post(url(), { ...UE, paidHours: 50 });
    expect(res.body.teachingUnit).toMatchObject({ paidHours: 50, paidHoursAuto: false, totalHours: 54 });
  });

  it('enregistre le contenu pédagogique', async () => {
    const res = await admin.post(url(), { ...UE, objectives: 'Maîtriser les algorithmes', prerequisites: 'Mathématiques', bibliography: 'Cormen et al.' });
    expect(res.body.teachingUnit).toMatchObject({ objectives: 'Maîtriser les algorithmes', bibliography: 'Cormen et al.' });
  });

  it('refuse un code en double dans le niveau', async () => {
    await admin.post(url(), UE);
    expect((await admin.post(url(), { ...UE, title: 'Autre' })).status).toBe(409);
  });

  it('refuse une spécialité d’une autre école', async () => {
    const other = (await admin.post('/api/schools', { code: 'ESC', name: 'ESC' })).body.school.id;
    const foreign = (await admin.post(`/api/schools/${other}/specialties`, { code: 'FI', name: 'Finance' })).body.specialty.id;
    const res = await admin.post(url(), { ...UE, specialtyId: foreign });
    expect(res.status).toBe(400);
    expect(res.body.error.details.specialtyId).toBeDefined();
  });

  it('refuse 0 h et des pondérations ≠ 100', async () => {
    expect((await admin.post(url(), { ...UE, cmHours: 0, tdHours: 0, tpHours: 0 })).status).toBe(400);
    expect((await admin.post(url(), { ...UE, ccWeight: 30, examWeight: 30 })).status).toBe(400);
  });
});

describe('modification', () => {
  it('recalcule total et volume payé quand les heures changent (mode automatique)', async () => {
    const id = (await admin.post(url(), UE)).body.teachingUnit.id;
    const res = await admin.patch(`/api/teaching-units/${id}`, { cmHours: 30 });
    expect(res.status).toBe(200);
    expect(res.body.teachingUnit).toMatchObject({ cmHours: 30, totalHours: 60, paidHours: 75 });
  });

  it('garde un volume payé manuel, et repasse en automatique avec paidHours: null', async () => {
    const id = (await admin.post(url(), { ...UE, paidHours: 50 })).body.teachingUnit.id;
    const kept = await admin.patch(`/api/teaching-units/${id}`, { tdHours: 20 });
    expect(kept.body.teachingUnit).toMatchObject({ totalHours: 56, paidHours: 50, paidHoursAuto: false });

    const auto = await admin.patch(`/api/teaching-units/${id}`, { paidHours: null });
    expect(auto.body.teachingUnit).toMatchObject({ paidHours: 68, paidHoursAuto: true });
  });

  it('revérifie les règles sur l’UE complète (pondérations)', async () => {
    const id = (await admin.post(url(), UE)).body.teachingUnit.id;
    const res = await admin.patch(`/api/teaching-units/${id}`, { tpWeight: 20 }); // 40 + 60 + 20 = 120
    expect(res.status).toBe(400);
    expect(res.body.error.details.ccWeight[0]).toContain('120 %');
    const ok = await admin.patch(`/api/teaching-units/${id}`, { ccWeight: 30, examWeight: 50, tpWeight: 20 });
    expect(ok.status).toBe(200);
  });

  it('la base refuse un total incohérent (contrainte CHECK)', async () => {
    const id = (await admin.post(url(), UE)).body.teachingUnit.id;
    await expect(prisma.teachingUnit.update({ where: { id }, data: { totalHours: 1 } })).rejects.toThrow();
  });
});

describe('liste et totaux de la maquette', () => {
  it('additionne crédits et heures par semestre et sur l’année', async () => {
    await admin.post(url(), { ...UE, hourlyRate: 10000 });
    await admin.post(url(), { ...UE, code: 'INF102', semester: 1, credits: 4, cmHours: 10, tdHours: 10, tpHours: 0 });
    await admin.post(url(), { ...UE, code: 'INF201', semester: 2, credits: 5, cmHours: 0, tdHours: 0, tpHours: 30, specialtyId });

    const res = await admin.get(url());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.totals.semester1).toMatchObject({ count: 2, credits: 10, totalHours: 74, paidHours: 91, estimatedCost: 660000 });
    expect(res.body.totals.semester2).toMatchObject({ count: 1, credits: 5, totalHours: 30 });
    expect(res.body.totals.year).toMatchObject({ count: 3, credits: 15, totalHours: 104 });
    expect(res.body.level).toMatchObject({ code: 'L1', requiredCredits: 60 });
  });

  it('filtre par semestre, spécialité (+ tronc commun) et recherche', async () => {
    await admin.post(url(), UE);
    await admin.post(url(), { ...UE, code: 'GL201', title: 'Génie logiciel', semester: 2, specialtyId });
    expect((await admin.get(`${url()}?semester=2`)).body.data).toHaveLength(1);
    expect((await admin.get(`${url()}?specialtyId=common`)).body.data).toHaveLength(1);
    expect((await admin.get(`${url()}?specialtyId=${specialtyId}`)).body.data).toHaveLength(2);
    expect((await admin.get(`${url()}?search=algo`)).body.data[0].code).toBe('INF101');
  });
});

describe('suppression et droits', () => {
  it('supprime une UE libre ; le niveau ne peut plus être supprimé tant qu’elle existe', async () => {
    const id = (await admin.post(url(), UE)).body.teachingUnit.id;
    expect((await admin.delete(`/api/levels/${levelId}`)).status).toBe(409);
    expect((await admin.delete(`/api/teaching-units/${id}`)).status).toBe(204);
    expect((await admin.get(`/api/teaching-units/${id}`)).status).toBe(404);
  });

  it('SCOLARITE d’une autre école : ni lecture ni écriture ; ENSEIGNANT : lecture seule', async () => {
    const other = (await admin.post('/api/schools', { code: 'ESC', name: 'ESC' })).body.school.id;
    await createUser('SCOLARITE', 'sco@t.local', { schoolId: other });
    const sco = as((await loginAs('sco@t.local')).token);
    expect((await sco.get(url())).status).toBe(403);
    expect((await sco.post(url(), UE)).status).toBe(403);

    await createUser('ENSEIGNANT', 'prof@t.local');
    const prof = as((await loginAs('prof@t.local')).token);
    expect((await prof.get(url())).status).toBe(200);
    expect((await prof.post(url(), UE)).status).toBe(403);
  });

  it('404 sur un niveau inexistant', async () => {
    const res = await admin.get('/api/levels/00000000-0000-4000-8000-000000000000/teaching-units');
    expect(res.status).toBe(404);
  });
});
