import { z } from 'zod';

/** Règle de mot de passe commune (création, réinitialisation, changement). */
export const passwordSchema = z
  .string()
  .min(8, 'Au moins 8 caractères')
  .max(128, '128 caractères maximum')
  .regex(/[A-Za-z]/, 'Au moins une lettre')
  .regex(/[0-9]/, 'Au moins un chiffre');

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    newPassword: passwordSchema,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "Le nouveau mot de passe doit être différent de l'actuel",
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
