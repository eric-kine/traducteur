import request from 'supertest';
import type { Role } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/modules/auth/password';

export const app = createApp();
export const PASSWORD = 'Secret123';

/** Vide les tables entre deux tests. */
export async function resetDb() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "refresh_tokens", "users", "counters", "syllabi", "certificates", "generated_documents", "grades", "teaching_assignments", "enrollments", "students", "teachers", "academic_years", "teaching_units", "levels", "specialties", "schools", "institutes" CASCADE');
}

export async function createUser(role: Role, email = `${role.toLowerCase()}@test.local`, extra = {}) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(PASSWORD),
      firstName: 'Test',
      lastName: role,
      role,
      ...extra,
    },
  });
}

/** Connecte un utilisateur et renvoie son jeton d'accès + le cookie de session. */
export async function loginAs(email: string, password = PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? [])[0]!;
  return { token: res.body.accessToken as string, cookie, body: res.body };
}

/** Requête authentifiée. */
export const as = (token: string) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url: string, body?: object) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
  put: (url: string, body?: object) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(body),
  patch: (url: string, body?: object) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body),
  delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});

export async function createInstitute() {
  return prisma.institute.create({ data: { name: 'Institut Test' } });
}
