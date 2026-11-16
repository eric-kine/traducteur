import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../../src/config/prisma';
import { app, createUser, loginAs, resetDb } from '../helpers';

let adminToken: string;
let adminId: string;
const auth = () => ({ Authorization: `Bearer ${adminToken}` });

beforeEach(async () => {
  await resetDb();
  adminId = (await createUser('ADMIN', 'admin@test.local')).id;
  adminToken = (await loginAs('admin@test.local')).token;
});

describe('contrôle d’accès', () => {
  it.each(['SCOLARITE', 'ENSEIGNANT', 'ETUDIANT'] as const)('refuse le rôle %s (403)', async (role) => {
    await createUser(role);
    const { token } = await loginAs(`${role.toLowerCase()}@test.local`);
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('refuse un visiteur non connecté (401)', async () => {
    expect((await request(app).get('/api/users')).status).toBe(401);
  });
});

describe('CRUD utilisateurs (ADMIN)', () => {
  it('crée, lit, liste et filtre', async () => {
    const created = await request(app).post('/api/users').set(auth()).send({
      email: 'Prof@Test.local',
      password: 'Secret123',
      firstName: 'Awa',
      lastName: 'Diallo',
      role: 'ENSEIGNANT',
    });
    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({ email: 'prof@test.local', role: 'ENSEIGNANT', isActive: true });
    expect(created.body.user.passwordHash).toBeUndefined();

    const one = await request(app).get(`/api/users/${created.body.user.id}`).set(auth());
    expect(one.body.user.lastName).toBe('Diallo');

    const list = await request(app).get('/api/users?role=ENSEIGNANT&search=diall').set(auth());
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0].email).toBe('prof@test.local');

    // Le nouveau compte peut se connecter
    await expect(loginAs('prof@test.local')).resolves.toBeTruthy();
  });

  it('refuse un email déjà utilisé (409)', async () => {
    const res = await request(app).post('/api/users').set(auth()).send({
      email: 'admin@test.local',
      password: 'Secret123',
      firstName: 'X',
      lastName: 'Y',
      role: 'ETUDIANT',
    });
    expect(res.status).toBe(409);
  });

  it('ignore schoolId pour les rôles autres que SCOLARITE', async () => {
    const institute = await prisma.institute.create({ data: { name: 'Inst' } });
    const school = await prisma.school.create({ data: { code: 'EIT', name: 'École', instituteId: institute.id } });

    const sco = await request(app).post('/api/users').set(auth()).send({
      email: 'sco@test.local', password: 'Secret123', firstName: 'A', lastName: 'B', role: 'SCOLARITE', schoolId: school.id,
    });
    expect(sco.body.user.schoolId).toBe(school.id);

    const prof = await request(app).post('/api/users').set(auth()).send({
      email: 'p@test.local', password: 'Secret123', firstName: 'A', lastName: 'B', role: 'ENSEIGNANT', schoolId: school.id,
    });
    expect(prof.body.user.schoolId).toBeNull();
  });

  it('renvoie 400 pour une école inexistante', async () => {
    const res = await request(app).post('/api/users').set(auth()).send({
      email: 'sco@test.local', password: 'Secret123', firstName: 'A', lastName: 'B', role: 'SCOLARITE',
      schoolId: '00000000-0000-4000-8000-000000000000',
    });
    expect(res.status).toBe(400);
  });

  it('modifie un utilisateur', async () => {
    const u = await createUser('ENSEIGNANT', 'prof@test.local');
    const res = await request(app).patch(`/api/users/${u.id}`).set(auth()).send({ role: 'SCOLARITE', lastName: 'Kone' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: 'SCOLARITE', lastName: 'Kone' });
  });

  it('désactive un compte et coupe ses sessions', async () => {
    const u = await createUser('ENSEIGNANT', 'prof@test.local');
    const { cookie } = await loginAs('prof@test.local');

    const res = await request(app).delete(`/api/users/${u.id}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401);
    // Le compte existe toujours (historique conservé)
    expect(await prisma.user.count({ where: { id: u.id } })).toBe(1);
  });

  it('réinitialise un mot de passe', async () => {
    const u = await createUser('ETUDIANT', 'etu@test.local');
    const res = await request(app).post(`/api/users/${u.id}/reset-password`).set(auth()).send({ password: 'Nouveau456' });
    expect(res.status).toBe(204);
    await expect(loginAs('etu@test.local', 'Nouveau456')).resolves.toBeTruthy();
  });

  it('renvoie 404 / 400 sur un identifiant inconnu ou invalide', async () => {
    expect((await request(app).get('/api/users/00000000-0000-4000-8000-000000000000').set(auth())).status).toBe(404);
    expect((await request(app).get('/api/users/pas-un-uuid').set(auth())).status).toBe(400);
  });
});

describe('protection des administrateurs', () => {
  it('un admin ne peut pas se désactiver ni se rétrograder', async () => {
    expect((await request(app).delete(`/api/users/${adminId}`).set(auth())).status).toBe(400);
    expect((await request(app).patch(`/api/users/${adminId}`).set(auth()).send({ role: 'ETUDIANT' })).status).toBe(400);
  });

  it('on ne peut pas retirer le dernier autre administrateur actif… sauf s’il en reste un', async () => {
    const other = await createUser('ADMIN', 'admin2@test.local');
    // Il reste l'admin connecté → autorisé
    const res = await request(app).patch(`/api/users/${other.id}`).set(auth()).send({ role: 'SCOLARITE' });
    expect(res.status).toBe(200);
  });
});
