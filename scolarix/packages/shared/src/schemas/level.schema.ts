import { z } from 'zod';
import { LEVEL_CYCLES } from '../enums';
import { codeSchema, requiredText } from './common';

export const createLevelSchema = z.object({
  code: codeSchema(10), // "L1", "M2", "N1"
  name: requiredText(100), // "Licence 1", "Niveau 1"
  cycle: z.enum(LEVEL_CYCLES),
  /** Position dans la progression. Absent = placé à la fin. */
  order: z.coerce.number().int().min(1, 'Minimum 1').max(20).optional(),
  requiredCredits: z.coerce.number().int().min(0).max(300).default(60),
});
export type CreateLevelInput = z.input<typeof createLevelSchema>;

export const updateLevelSchema = createLevelSchema
  .omit({ order: true }) // l'ordre se change via /reorder
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucun champ à modifier' });
export type UpdateLevelInput = z.input<typeof updateLevelSchema>;

/** Nouvel ordre complet des niveaux d'une école (liste de tous leurs ids). */
export const reorderLevelsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).refine((ids) => new Set(ids).size === ids.length, 'Doublons interdits'),
});
export type ReorderLevelsInput = z.infer<typeof reorderLevelsSchema>;
