import crypto from 'node:crypto';
import type { Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { toPublicUser } from '../../common/utils/user-dto';
import type { AuthUser } from '../../common/types';
import { assertCanManageSchool } from '../../common/middlewares/school-scope';
import { hashPassword } from '../auth/password';

/** Mot de passe provisoire lisible, conforme à la règle (lettres + chiffres), ex. "Scx-7KQ2-M9XH". */
export function temporaryPassword() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = () => Array.from(crypto.randomBytes(4), (b) => a[b % a.length]).join('');
  return `Scx-${part()}-${part()}7`;
}

/**
 * Crée (ou relie, si un compte du bon rôle existe déjà avec cet email) le compte
 * de connexion d'une fiche enseignant ou étudiant.
 */
async function createOrLink(opts: { email: string; firstName: string; lastName: string; role: Role; schoolId?: string | null; password?: string }) {
  const existing = await prisma.user.findUnique({ where: { email: opts.email }, include: { teacher: true, student: true } });
  if (existing) {
    if (existing.role !== opts.role) throw AppError.conflict(`Un compte ${existing.role} existe déjà avec l'email ${opts.email}`);
    if (existing.teacher || existing.student) throw AppError.conflict('Ce compte est déjà relié à une autre fiche');
    return { user: existing, temporaryPassword: null, linkedExisting: true };
  }
  const password = opts.password ?? temporaryPassword();
  const user = await prisma.user.create({
    data: { email: opts.email, firstName: opts.firstName, lastName: opts.lastName, role: opts.role, passwordHash: await hashPassword(password) },
  });
  return { user, temporaryPassword: opts.password ? null : password, linkedExisting: false };
}

export async function createTeacherAccount(user: AuthUser, teacherId: string) {
  if (user.role !== 'ADMIN' && user.role !== 'SCOLARITE') throw AppError.forbidden();
  const t = await prisma.teacher.findUnique({ where: { id: teacherId } });
  if (!t) throw AppError.notFound('Enseignant introuvable');
  if (t.userId) throw AppError.conflict('Cet enseignant a déjà un compte de connexion');
  const r = await createOrLink({ email: t.email, firstName: t.firstName, lastName: t.lastName, role: 'ENSEIGNANT' });
  await prisma.teacher.update({ where: { id: t.id }, data: { userId: r.user.id } });
  return { ...r, user: toPublicUser(r.user) };
}

export async function createStudentAccount(user: AuthUser, studentId: string, email?: string) {
  const s = await prisma.student.findUnique({ where: { id: studentId } });
  if (!s) throw AppError.notFound('Étudiant introuvable');
  assertCanManageSchool(user, s.schoolId);
  if (s.userId) throw AppError.conflict('Cet étudiant a déjà un compte de connexion');
  const login = (email ?? s.email)?.toLowerCase();
  if (!login) throw AppError.badRequest("Renseignez l'email de connexion de l'étudiant", { email: ["Email requis (la fiche n'en a pas)"] });
  const r = await createOrLink({ email: login, firstName: s.firstName, lastName: s.lastName, role: 'ETUDIANT' });
  await prisma.student.update({ where: { id: s.id }, data: { userId: r.user.id, ...(!s.email && { email: login }) } });
  return { ...r, user: toPublicUser(r.user) };
}

/** Compte relié (ou null) — affiché sur les fiches. */
export async function linkedAccount(kind: 'teacher' | 'student', id: string) {
  const row = kind === 'teacher'
    ? await prisma.teacher.findUnique({ where: { id }, include: { user: true } })
    : await prisma.student.findUnique({ where: { id }, include: { user: true } });
  if (!row) throw AppError.notFound();
  return row.user ? toPublicUser(row.user) : null;
}
