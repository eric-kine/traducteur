import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../../src/config/prisma';
import { app, createUser, loginAs, PASSWORD, resetDb } from '../helpers';

beforeEach(resetDb);

describe('POST /api/auth/login', () => {
  it('connecte un utilisateur valide et pose un cookie httpOnly', async () => {
    await createUser('ADMIN', 'admin@test.local');
    const res = await request(app).post('/api/auth/login').send({ email: 'ADMIN@test.local', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ email: 'admin@test.local', role: 'ADMIN' });
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('scolarix_rt=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/auth');
  });

  it('refuse un mauvais mot de passe avec le même message qu’un email inconnu', async () => {
    await createUser('ADMIN', 'admin@test.local');
    const wrongPwd = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', password: 'x' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@test.local', password: 'x' });

    expect(wrongPwd.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPwd.body).toEqual(unknown.body);
  });

  it('refuse un compte désactivé', async () => {
    await createUser('ENSEIGNANT', 'prof@test.local', { isActive: false });
    const res = await request(app).post('/api/auth/login').send({ email: 'prof@test.local', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('valide le format des données', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'pas-un-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('email');
    expect(res.body.error.details).toHaveProperty('password');
  });
});

describe('GET /api/auth/me', () => {
  it('renvoie l’utilisateur connecté', async () => {
    await createUser('ETUDIANT', 'etu@test.local');
    const { token } = await loginAs('etu@test.local');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ETUDIANT');
  });

  it('refuse sans jeton ou avec un jeton invalide', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc');
    expect(res.status).toBe(401);
  });

  it('refuse immédiatement un compte désactivé, même avec un jeton encore valide', async () => {
    const user = await createUser('SCOLARITE', 'sco@test.local');
    const { token } = await loginAs('sco@test.local');
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('délivre un nouveau jeton et fait tourner le cookie', async () => {
    await createUser('ADMIN', 'admin@test.local');
    const { cookie } = await loginAs('admin@test.local');

    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    const newCookie = String(res.headers['set-cookie']);
    expect(newCookie).toContain('scolarix_rt=');
    expect(newCookie.split(';')[0]).not.toEqual(cookie.split(';')[0]);
  });

  it('détecte la réutilisation d’un ancien jeton et ferme toutes les sessions', async () => {
    await createUser('ADMIN', 'admin@test.local');
    const { cookie: oldCookie } = await loginAs('admin@test.local');

    const first = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    const newCookie = String(first.headers['set-cookie']).split(';')[0]!;

    // L'ancien jeton est réutilisé (ex. volé) → refus
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('TOKEN_REUSED');

    // …et le jeton légitime le plus récent est lui aussi révoqué
    const legit = await request(app).post('/api/auth/refresh').set('Cookie', newCookie);
    expect(legit.status).toBe(401);
  });

  it('refuse sans cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('refuse un jeton expiré', async () => {
    await createUser('ADMIN', 'admin@test.local');
    const { cookie } = await loginAs('admin@test.local');
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });
});

describe('POST /api/auth/logout', () => {
  it('révoque la session', async () => {
    await createUser('ADMIN', 'admin@test.local');
    const { cookie } = await loginAs('admin@test.local');

    expect((await request(app).post('/api/auth/logout').set('Cookie', cookie)).status).toBe(204);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });
});

describe('POST /api/auth/change-password', () => {
  it('change le mot de passe et ferme les sessions', async () => {
    await createUser('ENSEIGNANT', 'prof@test.local');
    const { token, cookie } = await loginAs('prof@test.local');

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, newPassword: 'Nouveau456' });
    expect(res.status).toBe(204);

    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401);
    await expect(loginAs('prof@test.local')).rejects.toThrow();
    await expect(loginAs('prof@test.local', 'Nouveau456')).resolves.toBeTruthy();
  });

  it('refuse si le mot de passe actuel est faux ou le nouveau trop faible', async () => {
    await createUser('ENSEIGNANT', 'prof@test.local');
    const { token } = await loginAs('prof@test.local');
    const auth = { Authorization: `Bearer ${token}` };

    const wrong = await request(app)
      .post('/api/auth/change-password')
      .set(auth)
      .send({ currentPassword: 'Faux12345', newPassword: 'Nouveau456' });
    expect(wrong.status).toBe(400);

    const weak = await request(app)
      .post('/api/auth/change-password')
      .set(auth)
      .send({ currentPassword: PASSWORD, newPassword: 'court' });
    expect(weak.status).toBe(400);
  });
});
