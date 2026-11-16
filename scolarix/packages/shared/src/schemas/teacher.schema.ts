import { z } from 'zod';
import { SESSION_TYPES, TEACHER_STATUSES } from '../enums';
import { optionalText, requiredText } from './common';

const emptyToNull = (v: unknown) => (v === '' || v === undefined || Number.isNaN(v) ? null : v);

const teacherFields = {
  title: optionalText(20), // Dr, Pr, M., Mme
  firstName: requiredText(100),
  lastName: requiredText(100),
  grade: optionalText(100), // Assistant, Maître-assistant, Maître de conférences, Professeur…
  specialtyField: optionalText(150), // domaine de spécialité
  email: z.string().trim().toLowerCase().email('Adresse email invalide'),
  phone: optionalText(50),
  status: z.enum(TEACHER_STATUSES),
  hourlyRate: z.preprocess(emptyToNull, z.coerce.number().min(0).max(10_000_000).multipleOf(0.01).nullable()).optional(),
  isActive: z.boolean().optional(),
};

export const createTeacherSchema = z.object(teacherFields);
export type CreateTeacherInput = z.input<typeof createTeacherSchema>;

export const updateTeacherSchema = z
  .object(teacherFields)
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucun champ à modifier' });
export type UpdateTeacherInput = z.input<typeof updateTeacherSchema>;

export const listTeachersQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(TEACHER_STATUSES).optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

// ---- Affectations ------------------------------------------------------------

const hours = z.coerce.number({ invalid_type_error: 'Nombre attendu' }).min(0).max(999).multipleOf(0.01, '2 décimales maximum');

export const createAssignmentSchema = z.object({
  teacherId: z.string().uuid('Enseignant requis'),
  teachingUnitId: z.string().uuid('UE requise'),
  academicYearId: z.string().uuid('Année requise'),
  sessionType: z.enum(SESSION_TYPES),
  assignedHours: hours.refine((h) => h > 0, 'Au moins 0,01 h'),
  completedHours: hours.default(0),
  isCoordinator: z.boolean().default(false),
});
export type CreateAssignmentInput = z.input<typeof createAssignmentSchema>;

export const updateAssignmentSchema = z
  .object({
    assignedHours: hours.refine((h) => h > 0, 'Au moins 0,01 h'),
    completedHours: hours,
    isCoordinator: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucun champ à modifier' });
export type UpdateAssignmentInput = z.input<typeof updateAssignmentSchema>;

export const listAssignmentsQuerySchema = z.object({
  academicYearId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  teachingUnitId: z.string().uuid().optional(),
  levelId: z.string().uuid().optional(),
  schoolId: z.string().uuid().optional(),
});
