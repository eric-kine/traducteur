/**
 * Calculs des volumes horaires d'une UE.
 * Utilisés À L'IDENTIQUE par le serveur (valeurs enregistrées) et par le
 * formulaire React (affichage en temps réel).
 *
 * Les calculs se font en centièmes d'heure (entiers) pour éviter les
 * erreurs d'arrondi des nombres à virgule (0,1 + 0,2 ≠ 0,3 en JavaScript).
 */

/** Coefficients "équivalent TD" pour le calcul du volume payé. */
export const PAID_HOURS_COEFFICIENTS = { cm: 1.5, td: 1, tp: 1 } as const;

const toCents = (n: number | null | undefined) => Math.round((Number(n) || 0) * 100);
const fromCents = (c: number) => c / 100;

/** Arrondi à 2 décimales. */
export const round2 = (n: number) => fromCents(toCents(n));

export interface HoursInput {
  cmHours?: number | null;
  tdHours?: number | null;
  tpHours?: number | null;
}

/** Volume horaire total = CM + TD + TP. */
export function computeTotalHours({ cmHours, tdHours, tpHours }: HoursInput): number {
  return fromCents(toCents(cmHours) + toCents(tdHours) + toCents(tpHours));
}

/** Volume payé en équivalent TD = CM × 1,5 + TD × 1 + TP × 1. */
export function computePaidHours({ cmHours, tdHours, tpHours }: HoursInput): number {
  const c = PAID_HOURS_COEFFICIENTS;
  return fromCents(
    Math.round(toCents(cmHours) * c.cm + toCents(tdHours) * c.td + toCents(tpHours) * c.tp),
  );
}

/** Coût estimé = volume payé × taux horaire (null si pas de taux). */
export function computeCost(paidHours: number | null | undefined, hourlyRate: number | null | undefined): number | null {
  if (hourlyRate === null || hourlyRate === undefined || Number.isNaN(Number(hourlyRate))) return null;
  return fromCents(Math.round((toCents(paidHours) * toCents(hourlyRate)) / 100));
}

/** Somme des pondérations (doit valoir 100). */
export const weightsSum = (w: { ccWeight?: number; examWeight?: number; tpWeight?: number }) =>
  (Number(w.ccWeight) || 0) + (Number(w.examWeight) || 0) + (Number(w.tpWeight) || 0);

/** Formatage français : 37,5 h — 1 250 000 */
export const formatHours = (n: number) =>
  `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} h`;
export const formatAmount = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
