import { z } from 'zod';
import { ENROLLMENT_STATUSES, GENDERS, STUDENT_STATUSES } from '../enums';
import { isoDate } from './academic-year.schema';
import { optionalEmail, optionalText, requiredText } from './common';

const uuidOrNull = z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable());

/** Date de naissance : entre 10 et 100 ans. */
export const birthDateSchema = isoDate.refine((s) => {
  const age = (Date.now() - Date.parse(s)) / (365.25 * 24 * 3600 * 1000);
  return age >= 10 && age <= 100;
}, 'Âge incohérent (entre 10 et 100 ans)');

export const studentFields = {
  firstName: requiredText(100),
  lastName: requiredText(100),
  gender: z.enum(GENDERS, { errorMap: () => ({ message: 'M ou F' }) }),
  birthDate: birthDateSchema,
  birthPlace: requiredText(150),
  nationality: optionalText(100),
  email: optionalEmail,
  phone: optionalText(50),
  address: optionalText(),
  guardianName: optionalText(150),
  guardianRelation: optionalText(50),
  guardianPhone: optionalText(50),
  guardianEmail: optionalEmail,
};

/** Inscription optionnelle créée en même temps que l'étudiant. */
export const initialEnrollmentSchema = z.object({
  academicYearId: z.string().uuid(),
  levelId: z.string().uuid(),
  specialtyId: uuidOrNull.optional(),
});

export const createStudentSchema = z.object({
  ...studentFields,
  schoolId: z.string().uuid('École requise'),
  status: z.enum(STUDENT_STATUSES).optional(),
  enrollment: initialEnrollmentSchema.nullable().optional(),
});
export type CreateStudentInput = z.input<typeof createStudentSchema>;
export type CreateStudentData = z.output<typeof createStudentSchema>;

export const updateStudentSchema = z
  .object({ ...studentFields, status: z.enum(STUDENT_STATUSES) })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucun champ à modifier' });
export type UpdateStudentInput = z.input<typeof updateStudentSchema>;

export const listStudentsQuerySchema = z.object({
  search: z.string().trim().optional(),
  schoolId: z.string().uuid().optional(),
  status: z.enum(STUDENT_STATUSES).optional(),
  /** Filtres sur l'inscription d'une année */
  academicYearId: z.string().uuid().optional(),
  levelId: z.string().uuid().optional(),
  specialtyId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListStudentsQuery = z.output<typeof listStudentsQuerySchema>;

// ---- Inscriptions -----------------------------------------------------------

export const createEnrollmentSchema = z.object({
  studentId: z.string().uuid(),
  academicYearId: z.string().uuid('Année requise'),
  levelId: z.string().uuid('Niveau requis'),
  specialtyId: uuidOrNull.optional(),
  status: z.enum(ENROLLMENT_STATUSES).default('INSCRIT'),
  isRepeating: z.boolean().default(false),
});
export type CreateEnrollmentInput = z.input<typeof createEnrollmentSchema>;

export const updateEnrollmentSchema = z
  .object({
    levelId: z.string().uuid(),
    specialtyId: uuidOrNull,
    status: z.enum(ENROLLMENT_STATUSES),
    isRepeating: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucun champ à modifier' });
export type UpdateEnrollmentInput = z.input<typeof updateEnrollmentSchema>;

export const listEnrollmentsQuerySchema = z.object({
  academicYearId: z.string().uuid().optional(),
  schoolId: z.string().uuid().optional(),
  levelId: z.string().uuid().optional(),
  specialtyId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: z.enum(ENROLLMENT_STATUSES).optional(),
});

// ---- Import CSV --------------------------------------------------------------

/** Colonnes reconnues dans le fichier CSV (en-têtes, insensibles à la casse et aux accents). */
export const STUDENT_CSV_COLUMNS = [
  'nom', 'prenom', 'sexe', 'date_naissance', 'lieu_naissance', 'nationalite', 'email', 'telephone',
  'adresse', 'tuteur_nom', 'tuteur_lien', 'tuteur_telephone', 'tuteur_email', 'niveau', 'specialite',
] as const;
export const STUDENT_CSV_REQUIRED = ['nom', 'prenom', 'sexe', 'date_naissance', 'lieu_naissance'] as const;

export const importStudentsOptionsSchema = z.object({
  schoolId: z.string().uuid('École requise'),
  /** Si renseignée, chaque ligne ayant une colonne "niveau" est aussi inscrite pour cette année. */
  academicYearId: z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional()),
  dryRun: z.enum(['true', 'false']).transform((v) => v === 'true').default('true'),
});
