import { AppError } from '../errors/AppError';

/**
 * Bloque une suppression si des données y sont rattachées, avec un message
 * explicite (ex. "Suppression impossible : 3 étudiant(s), 2 niveau(x) rattaché(s).
 * Désactivez plutôt cet élément.").
 */
export function assertNoDependents(counts: Record<string, number>, labels: Record<string, string>) {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${labels[k] ?? k}`);
  if (parts.length) {
    throw new AppError(
      409,
      'HAS_DEPENDENTS',
      `Suppression impossible : ${parts.join(', ')} rattaché(s). Désactivez plutôt cet élément.`,
    );
  }
}
