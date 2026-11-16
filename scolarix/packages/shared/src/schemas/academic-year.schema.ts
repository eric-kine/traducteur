import { z } from 'zod';

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format AAAA-MM-JJ')
  .refine((s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s), 'Date invalide');

const base = z.object({
  label: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, 'Format attendu : 2026-2027')
    .refine((l) => Number(l.slice(5)) === Number(l.slice(0, 4)) + 1, 'La 2ᵉ année doit suivre la 1ʳᵉ (ex. 2026-2027)'),
  startDate: isoDate,
  endDate: isoDate,
  isCurrent: z.boolean().optional(),
});

const datesInOrder = (d: { startDate?: string; endDate?: string }) => !d.startDate || !d.endDate || d.startDate < d.endDate;

export const createAcademicYearSchema = base.refine(datesInOrder, { message: 'La fin doit être après le début', path: ['endDate'] });
export type CreateAcademicYearInput = z.input<typeof createAcademicYearSchema>;

export const updateAcademicYearSchema = base
  .partial()
  .refine(datesInOrder, { message: 'La fin doit être après le début', path: ['endDate'] })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucun champ à modifier' });
export type UpdateAcademicYearInput = z.input<typeof updateAcademicYearSchema>;
