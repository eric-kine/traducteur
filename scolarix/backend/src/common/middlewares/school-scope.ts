import type { AuthUser } from '../types';
import { AppError } from '../errors/AppError';

/**
 * Périmètre "école" d'un utilisateur :
 *  - ADMIN, ou SCOLARITE sans école → null (toutes les écoles)
 *  - SCOLARITE rattaché à une école → l'id de cette école
 * Utilisé par les modules suivants pour filtrer les requêtes Prisma.
 */
export function getSchoolScope(user: AuthUser): string | null {
  if (user.role === 'SCOLARITE') return user.schoolId;
  return null;
}

/** Lève 403 si l'utilisateur n'a pas accès à l'école demandée. */
export function assertSchoolAccess(user: AuthUser, schoolId: string): void {
  const scope = getSchoolScope(user);
  if (scope !== null && scope !== schoolId) {
    throw AppError.forbidden("Vous n'avez pas accès à cette école");
  }
}

/**
 * Droit de MODIFIER les données d'une école (spécialités, niveaux…) :
 * ADMIN partout, SCOLARITE uniquement dans son école (ou partout s'il n'a pas d'école).
 */
export function assertCanManageSchool(user: AuthUser, schoolId: string): void {
  if (user.role === 'ADMIN') return;
  if (user.role === 'SCOLARITE') return assertSchoolAccess(user, schoolId);
  throw AppError.forbidden();
}
