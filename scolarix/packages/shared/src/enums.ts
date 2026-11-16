/** Rôles applicatifs — miroir de l'enum Prisma `Role`. */
export const ROLES = ['ADMIN', 'SCOLARITE', 'ENSEIGNANT', 'ETUDIANT'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  SCOLARITE: 'Scolarité',
  ENSEIGNANT: 'Enseignant',
  ETUDIANT: 'Étudiant',
};

/** Cycle d'un niveau — miroir de l'enum Prisma `LevelCycle`. */
export const LEVEL_CYCLES = ['PREPA', 'LICENCE', 'MASTER', 'DOCTORAT', 'AUTRE'] as const;
export type LevelCycle = (typeof LEVEL_CYCLES)[number];

export const LEVEL_CYCLE_LABELS: Record<LevelCycle, string> = {
  PREPA: 'Préparatoire',
  LICENCE: 'Licence',
  MASTER: 'Master',
  DOCTORAT: 'Doctorat',
  AUTRE: 'Autre',
};
