import { z } from 'zod';
import { codeSchema, listQueryBase, optionalEmail, optionalText, optionalUrl, requiredText } from './common';

export const createSchoolSchema = z.object({
  code: codeSchema(10),
  name: requiredText(200),
  description: optionalText(2000),
  directorName: optionalText(150),
  email: optionalEmail,
  phone: optionalText(50),
  address: optionalText(),
  logoUrl: optionalUrl,
  isActive: z.boolean().optional(),
});
export type CreateSchoolInput = z.input<typeof createSchoolSchema>;

export const updateSchoolSchema = createSchoolSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucun champ à modifier' });
export type UpdateSchoolInput = z.input<typeof updateSchoolSchema>;

export const listSchoolsQuerySchema = listQueryBase;
