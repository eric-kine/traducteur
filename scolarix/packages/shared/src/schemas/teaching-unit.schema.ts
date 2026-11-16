import { z } from 'zod';
import { weightsSum } from '../calc/teaching-unit';
import { codeSchema, optionalText, requiredText } from './common';

/** Champ numérique de formulaire : "" ou null → null. */
const emptyToNull = (v: unknown) => (v === '' || v === undefined || Number.isNaN(v) ? null : v);

const hours = z.coerce
  .number({ invalid_type_error: 'Nombre attendu' })
  .min(0, 'Ne peut pas être négatif')
  .max(999, '999 h maximum')
  .multipleOf(0.01, '2 décimales maximum');

const weight = z.coerce.number().int('Nombre entier').min(0).max(100);

/** Champs communs création / modification. */
const fields = {
  code: codeSchema(15),
  title: requiredText(200),
  description: optionalText(5000),
  semester: z.coerce.number().int().min(1, 'Semestre 1 ou 2').max(2, 'Semestre 1 ou 2'),
  credits: z.coerce.number().int('Nombre entier').min(0).max(60),
  coefficient: z.coerce.number().min(0.25, 'Minimum 0,25').max(20).multipleOf(0.01),
  specialtyId: z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable()).optional(),

  cmHours: hours.default(0),
  tdHours: hours.default(0),
  tpHours: hours.default(0),
  /** null / absent = calcul automatique (équivalent TD) */
  paidHours: z.preprocess(emptyToNull, hours.nullable()).optional(),
  hourlyRate: z.preprocess(
    emptyToNull,
    z.coerce.number().min(0, 'Ne peut pas être négatif').max(10_000_000).multipleOf(0.01).nullable(),
  ).optional(),

  ccWeight: weight.default(40),
  examWeight: weight.default(60),
  tpWeight: weight.default(0),

  objectives: optionalText(10_000),
  prerequisites: optionalText(10_000),
  bibliography: optionalText(10_000),
  isActive: z.boolean().optional(),
};

/** Règles qui portent sur plusieurs champs (réutilisées par le serveur après fusion en modification). */
export function checkTeachingUnitRules(
  d: { cmHours?: number; tdHours?: number; tpHours?: number; ccWeight?: number; examWeight?: number; tpWeight?: number },
  ctx: z.RefinementCtx,
) {
  if ((d.cmHours ?? 0) + (d.tdHours ?? 0) + (d.tpHours ?? 0) <= 0) {
    ctx.addIssue({ code: 'custom', path: ['cmHours'], message: 'Au moins une heure de CM, TD ou TP' });
  }
  const sum = weightsSum(d);
  if (sum !== 100) {
    ctx.addIssue({ code: 'custom', path: ['ccWeight'], message: `La somme des pondérations doit faire 100 % (actuellement ${sum} %)` });
  }
}

export const createTeachingUnitSchema = z.object(fields).superRefine(checkTeachingUnitRules);
export type CreateTeachingUnitInput = z.input<typeof createTeachingUnitSchema>;
export type CreateTeachingUnitData = z.output<typeof createTeachingUnitSchema>;

/** Modification partielle : les règles croisées sont revérifiées côté serveur sur l'UE fusionnée. */
export const updateTeachingUnitSchema = z
  .object(fields)
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucun champ à modifier' });
export type UpdateTeachingUnitInput = z.input<typeof updateTeachingUnitSchema>;
export type UpdateTeachingUnitData = z.output<typeof updateTeachingUnitSchema>;

export const listTeachingUnitsQuerySchema = z.object({
  search: z.string().trim().optional(),
  semester: z.coerce.number().int().min(1).max(2).optional(),
  /** "common" = UE de tronc commun uniquement */
  specialtyId: z.union([z.literal('common'), z.string().uuid()]).optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
export type ListTeachingUnitsQuery = z.output<typeof listTeachingUnitsQuerySchema>;
