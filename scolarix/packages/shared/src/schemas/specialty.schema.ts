import { z } from 'zod';
import { codeSchema, listQueryBase, optionalText, requiredText } from './common';

export const createSpecialtySchema = z.object({
  code: codeSchema(10),
  name: requiredText(150),
  description: optionalText(2000),
  diplomaTitle: optionalText(200),
  isActive: z.boolean().optional(),
});
export type CreateSpecialtyInput = z.input<typeof createSpecialtySchema>;

export const updateSpecialtySchema = createSpecialtySchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucun champ à modifier' });
export type UpdateSpecialtyInput = z.input<typeof updateSpecialtySchema>;

export const listSpecialtiesQuerySchema = listQueryBase;
