import { z } from 'zod';
import { SESSION_TYPES } from '../enums';
import { GRADING_RULES } from '../calc/grades';

const text = (max = 10_000) =>
  z.string().trim().max(max, `${max} caractères maximum`).transform((v) => (v === '' ? null : v)).nullable().optional();

/** Un chapitre / une séquence du contenu détaillé. */
export const syllabusChapterSchema = z.object({
  title: z.string().trim().min(1, 'Titre requis').max(200),
  sessionType: z.preprocess((v) => (v === '' ? null : v), z.enum(SESSION_TYPES).nullable()).optional(),
  hours: z.preprocess(
    (v) => (v === '' || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? null : v),
    z.coerce.number().min(0).max(999).multipleOf(0.25, 'Par quart d’heure').nullable(),
  ).optional(),
  description: text(2000),
});
export type SyllabusChapter = z.output<typeof syllabusChapterSchema>;

export const saveSyllabusSchema = z.object({
  year: z.string().regex(/^\d{4}-\d{4}$/, 'Format attendu : 2026-2027'),
  status: z.enum(['BROUILLON', 'PUBLIE']).default('BROUILLON'),
  objectives: text(),
  competencies: text(),
  prerequisites: text(),
  content: z.array(syllabusChapterSchema).max(60, '60 chapitres maximum').default([]),
  teachingMethods: text(),
  evaluationMethods: text(),
  bibliography: text(),
});
export type SaveSyllabusInput = z.input<typeof saveSyllabusSchema>;

export const syllabusQuerySchema = z.object({
  /** Année (2026-2027) ; par défaut l'année courante */
  year: z.string().regex(/^\d{4}-\d{4}$/, 'Format attendu : 2026-2027').optional(),
  format: z.enum(['pdf', 'html']).default('pdf'),
});

export const levelSyllabiQuerySchema = z.object({
  year: z.string().regex(/^\d{4}-\d{4}$/, 'Format attendu : 2026-2027').optional(),
  semester: z.coerce.number().int().min(1).max(2).optional(),
  /** Inclure les UE dont le syllabus n'a pas encore été rédigé (contenu de l'UE seul) */
  includeDrafts: z.enum(['true', 'false']).transform((v) => v === 'true').default('true'),
});

/**
 * Modalités d'évaluation générées automatiquement à partir des pondérations de l'UE
 * (même règles que le calcul des notes, module 4).
 */
export function evaluationSummary(w: { ccWeight: number; examWeight: number; tpWeight: number }): string[] {
  const parts = [
    w.ccWeight > 0 && `Contrôle continu : ${w.ccWeight} %`,
    w.examWeight > 0 && `Examen final : ${w.examWeight} %`,
    w.tpWeight > 0 && `Travaux pratiques : ${w.tpWeight} %`,
  ].filter(Boolean) as string[];
  return [
    `Note de l'UE = ${parts.join(' + ')}.`,
    `UE validée si la note est au moins ${GRADING_RULES.passMark}/20, ou par compensation si la moyenne du semestre est au moins ${GRADING_RULES.passMark}/20 et la note au moins ${GRADING_RULES.eliminatoryMark}/20.`,
    w.examWeight > 0
      ? "Session de rattrapage : la note d'examen de rattrapage remplace celle de l'examen, le contrôle continu est conservé ; la meilleure des deux notes est retenue."
      : '',
  ].filter(Boolean);
}
