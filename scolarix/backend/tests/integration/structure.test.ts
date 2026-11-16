import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/config/prisma';
import { as, createInstitute, createUser, loginAs, resetDb } from '../helpers';

let admin: ReturnType<typeof as>;

beforeEach(async () => {
  await resetDb();
  await createUser('ADMIN', 'admin@test.local');
  admin = as((await loginAs('admin@test.local')).token);
});

async function newSchool(code = 'EIT', name = "École d'Ingénieurs") {
  const res = await admin.post('/api/schools', { code, name });
  expect(res.status).toBe(201);
  return res.body.school as { id: string };
}

async function userOf(role: 'SCOLARITE' | 'ENSEIGNANT', schoolId: string | null = null, email = `${role}@t.local`) {
  await createUser(role, email.toLowerCase(), { schoolId });
  return as((await loginAs(email.toLowerCase())).token);
}

// ---------------------------------------------------------------------------
describe('Institut', () => {
  it('404 tant que non configuré, puis création et mise à jour (PUT)', async () => {
    expect((await admin.get('/api/institute')).status).toBe(404);

    const created = await admin.put('/api/institute', { name: 'Institut Supérieur', city: 'Dakar', email: 'Contact@ISS.sn' });
    expect(created.status).toBe(200);
    expect(created.body.institute).toMatchObject({ name: 'Institut Supérieur', city: 'Dakar', email: 'contact@iss.sn' });

    const updated = await admin.put('/api/institute', { name: 'ISS', city: '' });
    expect(updated.body.institute.id).toBe(created.body.institute.id); // toujours une seule ligne
    expect(updated.body.institute.city).toBeNull(); // champ vidé
    expect(await prisma.institute.count()).toBe(1);
  });

  it('valide les champs (nom requis, email et site web)', async () => {
    const res = await admin.put('/api/institute', { name: '', email: 'pas-un-email', website: 'iss.sn' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details)).toEqual(expect.arrayContaining(['name', 'email', 'website']));
  });

  it('lecture pour tous, modification réservée à ADMIN', async () => {
    await createInstitute();
    const prof = await userOf('ENSEIGNANT');
    expect((await prof.get('/api/institute')).status).toBe(200);
    expect((await prof.put('/api/institute', { name: 'X' })).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
describe('Écoles', () => {
  beforeEach(createInstitute);

  it('CRUD complet avec compteurs', async () => {
    const created = await admin.post('/api/schools', { code: 'eit', name: "École d'Ingénieurs", email: '' });
    expect(created.status).toBe(201);
    expect(created.body.school).toMatchObject({ code: 'EIT', email: null, isActive: true });
    expect(created.body.school._count).toEqual({ specialties: 0, levels: 0, students: 0 });
    const id = created.body.school.id;

    expect((await admin.get(`/api/schools/${id}`)).body.school.name).toBe("École d'Ingénieurs");
    expect((await admin.patch(`/api/schools/${id}`, { name: 'EIT Dakar', isActive: false })).body.school).toMatchObject({
      name: 'EIT Dakar',
      isActive: false,
    });
    expect((await admin.get('/api/schools?isActive=false')).body.data).toHaveLength(1);
    expect((await admin.get('/api/schools?search=dakar')).body.data).toHaveLength(1);

    expect((await admin.delete(`/api/schools/${id}`)).status).toBe(204);
    expect((await admin.get(`/api/schools/${id}`)).status).toBe(404);
  });

  it('refuse un code en double ou invalide', async () => {
    await newSchool('EIT');
    const dup = await admin.post('/api/schools', { code: 'eit', name: 'Autre' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.details.code).toBeDefined();
    const bad = await admin.post('/api/schools', { code: 'E I T', name: 'X' });
    expect(bad.status).toBe(400);
  });

  it("exige que l'institut soit configuré", async () => {
    await prisma.institute.deleteMany();
    const res = await admin.post('/api/schools', { code: 'EIT', name: 'X' });
    expect(res.status).toBe(400);
  });

  it('bloque la suppression si des spécialités ou niveaux sont rattachés', async () => {
    const school = await newSchool();
    await admin.post(`/api/schools/${school.id}/specialties`, { code: 'GL', name: 'Génie Logiciel' });
    const res = await admin.delete(`/api/schools/${school.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('1 spécialité(s)');
  });

  it('un agent SCOLARITE ne voit que son école et ne peut pas créer d’école', async () => {
    const a = await newSchool('EIT');
    const b = await newSchool('ECO', 'École de Commerce');
    const sco = await userOf('SCOLARITE', a.id);

    const list = await sco.get('/api/schools');
    expect(list.body.data.map((s: { id: string }) => s.id)).toEqual([a.id]);
    expect((await sco.get(`/api/schools/${b.id}`)).status).toBe(403);
    expect((await sco.post('/api/schools', { code: 'X', name: 'X' })).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
describe('Spécialités', () => {
  let schoolId: string;
  beforeEach(async () => {
    await createInstitute();
    schoolId = (await newSchool()).id;
  });

  it('CRUD complet', async () => {
    const created = await admin.post(`/api/schools/${schoolId}/specialties`, {
      code: 'gl',
      name: 'Génie Logiciel',
      diplomaTitle: 'Licence en Génie Logiciel',
    });
    expect(created.status).toBe(201);
    expect(created.body.specialty).toMatchObject({ code: 'GL', schoolId });
    const id = created.body.specialty.id;

    expect((await admin.get(`/api/schools/${schoolId}/specialties`)).body.data).toHaveLength(1);
    expect((await admin.patch(`/api/specialties/${id}`, { name: 'Génie Logiciel & IA' })).body.specialty.name).toBe(
      'Génie Logiciel & IA',
    );
    expect((await admin.delete(`/api/specialties/${id}`)).status).toBe(204);
    expect((await admin.get(`/api/specialties/${id}`)).status).toBe(404);
  });

  it('code unique par école (mais réutilisable dans une autre école)', async () => {
    const other = await newSchool('ECO', 'Commerce');
    await admin.post(`/api/schools/${schoolId}/specialties`, { code: 'GL', name: 'A' });
    expect((await admin.post(`/api/schools/${schoolId}/specialties`, { code: 'GL', name: 'B' })).status).toBe(409);
    expect((await admin.post(`/api/schools/${other.id}/specialties`, { code: 'GL', name: 'C' })).status).toBe(201);
  });

  it('404 sur une école inexistante', async () => {
    const res = await admin.get('/api/schools/00000000-0000-4000-8000-000000000000/specialties');
    expect(res.status).toBe(404);
  });

  it('SCOLARITE gère les spécialités de SON école uniquement ; ENSEIGNANT en lecture seule', async () => {
    const other = await newSchool('ECO', 'Commerce');
    const sco = await userOf('SCOLARITE', schoolId);
    expect((await sco.post(`/api/schools/${schoolId}/specialties`, { code: 'GL', name: 'GL' })).status).toBe(201);
    expect((await sco.post(`/api/schools/${other.id}/specialties`, { code: 'FI', name: 'Finance' })).status).toBe(403);

    const prof = await userOf('ENSEIGNANT');
    expect((await prof.get(`/api/schools/${schoolId}/specialties`)).status).toBe(200);
    expect((await prof.post(`/api/schools/${schoolId}/specialties`, { code: 'X', name: 'X' })).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
describe('Niveaux', () => {
  let schoolId: string;
  const url = () => `/api/schools/${schoolId}/levels`;
  const codes = async () => (await admin.get(url())).body.data.map((l: { code: string; order: number }) => `${l.order}:${l.code}`);

  beforeEach(async () => {
    await createInstitute();
    schoolId = (await newSchool()).id;
  });

  it('crée les niveaux à la suite (ordre automatique)', async () => {
    await admin.post(url(), { code: 'L1', name: 'Licence 1', cycle: 'LICENCE' });
    await admin.post(url(), { code: 'L2', name: 'Licence 2', cycle: 'LICENCE' });
    const m1 = await admin.post(url(), { code: 'M1', name: 'Master 1', cycle: 'MASTER', requiredCredits: 60 });
    expect(m1.status).toBe(201);
    expect(m1.body.level.order).toBe(3);
    expect(await codes()).toEqual(['1:L1', '2:L2', '3:M1']);
  });

  it('insère à une position donnée en décalant les suivants', async () => {
    await admin.post(url(), { code: 'L1', name: 'Licence 1', cycle: 'LICENCE' });
    await admin.post(url(), { code: 'L3', name: 'Licence 3', cycle: 'LICENCE' });
    await admin.post(url(), { code: 'L2', name: 'Licence 2', cycle: 'LICENCE', order: 2 });
    expect(await codes()).toEqual(['1:L1', '2:L2', '3:L3']);
  });

  it('réordonne et recompacte après suppression', async () => {
    const ids: string[] = [];
    for (const code of ['N1', 'N2', 'N3']) {
      ids.push((await admin.post(url(), { code, name: code, cycle: 'PREPA' })).body.level.id);
    }
    const res = await admin.put(`${url()}/order`, { ids: [ids[2], ids[0], ids[1]] });
    expect(res.status).toBe(200);
    expect(await codes()).toEqual(['1:N3', '2:N1', '3:N2']);

    expect((await admin.delete(`/api/levels/${ids[2]}`)).status).toBe(204);
    expect(await codes()).toEqual(['1:N1', '2:N2']);
  });

  it('refuse un réordonnancement incomplet', async () => {
    const a = (await admin.post(url(), { code: 'N1', name: 'N1', cycle: 'PREPA' })).body.level.id;
    await admin.post(url(), { code: 'N2', name: 'N2', cycle: 'PREPA' });
    expect((await admin.put(`${url()}/order`, { ids: [a] })).status).toBe(400);
  });

  it('modifie un niveau et refuse un code en double', async () => {
    const l1 = (await admin.post(url(), { code: 'L1', name: 'Licence 1', cycle: 'LICENCE' })).body.level;
    await admin.post(url(), { code: 'L2', name: 'Licence 2', cycle: 'LICENCE' });
    expect((await admin.patch(`/api/levels/${l1.id}`, { name: 'Licence 1 (L1)' })).body.level.name).toBe('Licence 1 (L1)');
    expect((await admin.patch(`/api/levels/${l1.id}`, { code: 'L2' })).status).toBe(409);
  });

  it('valide cycle et crédits', async () => {
    const res = await admin.post(url(), { code: 'X', name: 'X', cycle: 'INCONNU', requiredCredits: -5 });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details)).toEqual(expect.arrayContaining(['cycle', 'requiredCredits']));
  });

  it('bloque la suppression d’un niveau qui a des UE', async () => {
    const level = (await admin.post(url(), { code: 'L1', name: 'Licence 1', cycle: 'LICENCE' })).body.level;
    await prisma.teachingUnit.create({ data: { code: 'INF101', title: 'Algo', semester: 1, credits: 6, levelId: level.id } });
    const res = await admin.delete(`/api/levels/${level.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('1 UE');
  });
});
