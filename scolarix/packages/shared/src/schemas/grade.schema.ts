import { z } from 'zod';

const score = z.preprocess(
  (v) => (v === '' || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? null : v),
  z.coerce.number({ invalid_type_error: 'Note invalide' }).min(0, 'Note entre 0 et 20').max(20, 'Note entre 0 et 20').multipleOf(0.01, '2 décimales maximum').nullable(),
);

export const gradeEntrySchema = z.object({
  enrollmentId: z.string().uuid(),
  ccScore: score.optional(),
  examScore: score.optional(),
  tpScore: score.optional(),
  isAbsent: z.boolean().default(false),
  comment: z.string().trim().max(500).optional().nullable(),
});
export type GradeEntryInput = z.input<typeof gradeEntrySchema>;

/** Enregistrement d'une feuille de notes complète (une UE, une année, une session). */
export const saveGradeSheetSchema = z.object({
  academicYearId: z.string().uuid(),
  session: z.enum(['NORMALE', 'RATTRAPAGE']).default('NORMALE'),
  grades: z.array(gradeEntrySchema).min(1).max(1000),
});
export type SaveGradeSheetInput = z.input<typeof saveGradeSheetSchema>;

export const gradeSheetQuerySchema = z.object({
  academicYearId: z.string().uuid(),
  session: z.enum(['NORMALE', 'RATTRAPAGE']).default('NORMALE'),
});

export const transcriptQuerySchema = z.object({
  /** Libellé de l'année : 2026-2027 */
  year: z.string().regex(/^\d{4}-\d{4}$/, 'Format attendu : 2026-2027'),
  format: z.enum(['pdf', 'html']).default('pdf'),
});
