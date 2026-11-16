import { z } from 'zod';
import { ROLES } from '../enums';
import { passwordSchema } from './auth.schema';

const name = z.string().trim().min(1, 'Requis').max(100);

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse email invalide'),
  password: passwordSchema,
  firstName: name,
  lastName: name,
  role: z.enum(ROLES),
  /** Périmètre d'un agent SCOLARITE (null = toutes les écoles) */
  schoolId: z.string().uuid().nullable().optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Adresse email invalide'),
    firstName: name,
    lastName: name,
    role: z.enum(ROLES),
    schoolId: z.string().uuid().nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucun champ à modifier' });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({ password: passwordSchema });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const listUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
