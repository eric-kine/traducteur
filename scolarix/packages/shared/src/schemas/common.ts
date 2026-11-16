import { z } from 'zod';

/** Texte optionnel : une chaîne vide devient null (champ effacé). */
export const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const requiredText = (max = 150) => z.string().trim().min(1, 'Requis').max(max, `${max} caractères maximum`);

/** Code court en majuscules : lettres, chiffres, tiret (ex. "EIT", "GL", "L1"). */
export const codeSchema = (max = 10) =>
  z
    .string()
    .trim()
    .min(1, 'Requis')
    .max(max, `${max} caractères maximum`)
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9-]+$/, 'Lettres, chiffres et tirets uniquement'));

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v === '' ? null : v))
  .pipe(z.string().email('Adresse email invalide').nullable())
  .nullable()
  .optional();

export const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .pipe(z.string().url('Adresse web invalide (commencez par https://)').nullable())
  .nullable()
  .optional();

export const listQueryBase = z.object({
  search: z.string().trim().optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export const uuidParam = (name = 'id') => z.object({ [name]: z.string().uuid('Identifiant invalide') });
