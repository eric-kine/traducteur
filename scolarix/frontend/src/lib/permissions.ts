import type { UserDto } from '@scolarix/shared';

/** Peut modifier les données d'une école (spécialités, niveaux). Miroir de la règle serveur. */
export const canManageSchool = (user: UserDto | null, schoolId: string) =>
  !!user &&
  (user.role === 'ADMIN' || (user.role === 'SCOLARITE' && (user.schoolId === null || user.schoolId === schoolId)));

export const isAdmin = (user: UserDto | null) => user?.role === 'ADMIN';
