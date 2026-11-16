import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { CreateStudentData, ListStudentsQuery, updateStudentSchema } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../common/errors/AppError';
import { assertNoDependents } from '../../common/utils/dependents';
import { nextMatricule } from '../../common/utils/counter';
import { fromDate, toDate } from '../../common/utils/dates';
import type { AuthUser } from '../../common/types';
import { detectImageType } from '../../common/middlewares/upload';
import { assertCanManageSchool, assertSchoolAccess, getSchoolScope } from '../../common/middlewares/school-scope';
import { assertEnrollmentTargets, enrollmentInclude, toDto as enrollmentToDto } from '../enrollments/enrollments.service';
import { getCurrent } from '../academic-years/academic-years.service';

type Db = Prisma.TransactionClient | typeof prisma;

const include = {
  school: { select: { id: true, code: true, name: true } },
  enrollments: { include: enrollmentInclude, orderBy: { academicYear: { startDate: 'desc' } }, take: 1 },
} as const satisfies Prisma.StudentInclude;

type StudentRow = Prisma.StudentGetPayload<{ include: typeof include }>;

export const toDto = (s: StudentRow) => ({
  id: s.id,
  matricule: s.matricule,
  firstName: s.firstName,
  lastName: s.lastName,
  gender: s.gender,
  birthDate: fromDate(s.birthDate),
  birthPlace: s.birthPlace,
  nationality: s.nationality,
  email: s.email,
  phone: s.phone,
  address: s.address,
  hasPhoto: !!s.photoPath,
  status: s.status,
  guardianName: s.guardianName,
  guardianRelation: s.guardianRelation,
  guardianPhone: s.guardianPhone,
  guardianEmail: s.guardianEmail,
  school: s.school,
  currentEnrollment: s.enrollments[0] ? enrollmentToDto(s.enrollments[0]) : null,
  createdAt: s.createdAt.toISOString(),
});

/** Année utilisée dans le matricule : celle de l'inscription, sinon l'année courante, sinon l'année civile. */
async function matriculeYear(academicYearId: string | undefined, db: Db) {
  const year = academicYearId
    ? await db.academicYear.findUnique({ where: { id: academicYearId }, select: { label: true } })
    : await db.academicYear.findFirst({ where: { isCurrent: true }, select: { label: true } });
  return year ? Number(year.label.slice(0, 4)) : new Date().getFullYear();
}

async function getSchool(schoolId: string, db: Db = prisma) {
  const school = await db.school.findUnique({ where: { id: schoolId }, select: { id: true, code: true } });
  if (!school) throw AppError.badRequest('École introuvable', { schoolId: ['École introuvable'] });
  return school;
}

/**
 * Création (utilisée aussi par l'import CSV, dans une transaction) :
 * matricule automatique + inscription facultative.
 */
export async function insertStudent(data: CreateStudentData, db: Db) {
  const school = await getSchool(data.schoolId, db);
  if (data.enrollment) await assertEnrollmentTargets(school.id, data.enrollment, db);
  const matricule = await nextMatricule(school.code, await matriculeYear(data.enrollment?.academicYearId, db), db);
  const { enrollment, birthDate, schoolId, ...fields } = data;
  return db.student.create({
    data: {
      ...fields,
      matricule,
      birthDate: toDate(birthDate),
      school: { connect: { id: schoolId } },
      ...(enrollment && {
        enrollments: {
          create: {
            academicYearId: enrollment.academicYearId,
            levelId: enrollment.levelId,
            specialtyId: enrollment.specialtyId ?? null,
            status: 'INSCRIT',
          },
        },
      }),
    },
    include,
  });
}

export async function create(user: AuthUser, data: CreateStudentData) {
  assertCanManageSchool(user, data.schoolId);
  return toDto(await prisma.$transaction((tx) => insertStudent(data, tx)));
}

export async function list(user: AuthUser, q: ListStudentsQuery) {
  const scope = getSchoolScope(user);
  if (scope && q.schoolId && q.schoolId !== scope) throw AppError.forbidden();
  const enrollmentFilter =
    q.academicYearId || q.levelId || q.specialtyId
      ? {
          enrollments: {
            some: {
              ...(q.academicYearId && { academicYearId: q.academicYearId }),
              ...(q.levelId && { levelId: q.levelId }),
              ...(q.specialtyId && { specialtyId: q.specialtyId }),
            },
          },
        }
      : {};
  const where: Prisma.StudentWhereInput = {
    ...((scope ?? q.schoolId) && { schoolId: scope ?? q.schoolId }),
    ...(q.status && { status: q.status }),
    ...enrollmentFilter,
    ...(q.search && {
      OR: q.search.split(/\s+/).map((word) => ({
        OR: [
          { matricule: { contains: word, mode: 'insensitive' as const } },
          { lastName: { contains: word, mode: 'insensitive' as const } },
          { firstName: { contains: word, mode: 'insensitive' as const } },
        ],
      })),
    }),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      include,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.student.count({ where }),
  ]);
  return { data: rows.map(toDto), page: q.page, pageSize: q.pageSize, total };
}

async function findOrFail(id: string) {
  const s = await prisma.student.findUnique({ where: { id }, include });
  if (!s) throw AppError.notFound('Étudiant introuvable');
  return s;
}

export async function getById(user: AuthUser, id: string) {
  const s = await findOrFail(id);
  assertSchoolAccess(user, s.schoolId);
  return toDto(s);
}

export async function update(user: AuthUser, id: string, data: z.output<typeof updateStudentSchema>) {
  const s = await findOrFail(id);
  assertCanManageSchool(user, s.schoolId);
  const { birthDate, ...rest } = data;
  return toDto(
    await prisma.student.update({ where: { id }, data: { ...rest, ...(birthDate && { birthDate: toDate(birthDate) }) }, include }),
  );
}

/** Suppression possible si aucune note ni document émis ; sinon changer le statut. */
export async function remove(user: AuthUser, id: string) {
  const s = await findOrFail(id);
  assertCanManageSchool(user, s.schoolId);
  const [grades, documents] = await Promise.all([
    prisma.grade.count({ where: { enrollment: { studentId: id } } }),
    prisma.generatedDocument.count({ where: { studentId: id } }),
  ]);
  try {
    assertNoDependents({ grades, documents }, { grades: 'note(s)', documents: 'document(s) émis' });
  } catch (e) {
    throw new AppError(409, 'HAS_DEPENDENTS', (e as Error).message.replace('Désactivez plutôt cet élément.', "Changez plutôt son statut (Abandon, Diplômé…)."));
  }
  await prisma.$transaction([prisma.enrollment.deleteMany({ where: { studentId: id } }), prisma.student.delete({ where: { id } })]);
  if (s.photoPath) await fs.rm(photoFile(s.photoPath), { force: true });
}

// ---- Photo ----------------------------------------------------------------

const PHOTO_DIR = () => path.resolve(env.UPLOAD_DIR, 'students');
const photoFile = (name: string) => path.join(PHOTO_DIR(), path.basename(name));
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

export async function setPhoto(user: AuthUser, id: string, buffer: Buffer | undefined) {
  const s = await findOrFail(id);
  assertCanManageSchool(user, s.schoolId);
  if (!buffer?.length) throw AppError.badRequest('Aucun fichier reçu');
  const ext = detectImageType(buffer);
  if (!ext) throw AppError.badRequest('Format accepté : JPEG, PNG ou WebP');

  await fs.mkdir(PHOTO_DIR(), { recursive: true });
  // Nom aléatoire : on ne réutilise jamais le nom envoyé par le navigateur
  const name = `${id}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  await fs.writeFile(photoFile(name), buffer);
  await prisma.student.update({ where: { id }, data: { photoPath: name } });
  if (s.photoPath) await fs.rm(photoFile(s.photoPath), { force: true });
}

export async function getPhoto(user: AuthUser, id: string) {
  const s = await findOrFail(id);
  assertSchoolAccess(user, s.schoolId);
  if (!s.photoPath) throw AppError.notFound('Pas de photo');
  const ext = path.extname(s.photoPath).slice(1) as keyof typeof MIME;
  return { file: photoFile(s.photoPath), mime: MIME[ext] ?? 'application/octet-stream' };
}

export async function deletePhoto(user: AuthUser, id: string) {
  const s = await findOrFail(id);
  assertCanManageSchool(user, s.schoolId);
  if (s.photoPath) {
    await prisma.student.update({ where: { id }, data: { photoPath: null } });
    await fs.rm(photoFile(s.photoPath), { force: true });
  }
}

export { getCurrent };
