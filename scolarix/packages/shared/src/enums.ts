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

export const GENDERS = ['M', 'F'] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_LABELS: Record<Gender, string> = { M: 'Masculin', F: 'Féminin' };

export const STUDENT_STATUSES = ['ACTIF', 'SUSPENDU', 'DIPLOME', 'ABANDON', 'EXCLU'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];
export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIF: 'Actif', SUSPENDU: 'Suspendu', DIPLOME: 'Diplômé', ABANDON: 'Abandon', EXCLU: 'Exclu',
};

export const TEACHER_STATUSES = ['PERMANENT', 'VACATAIRE', 'INVITE'] as const;
export type TeacherStatus = (typeof TEACHER_STATUSES)[number];
export const TEACHER_STATUS_LABELS: Record<TeacherStatus, string> = {
  PERMANENT: 'Permanent', VACATAIRE: 'Vacataire', INVITE: 'Invité',
};

export const ENROLLMENT_STATUSES = ['EN_ATTENTE', 'INSCRIT', 'ADMIS', 'AJOURNE', 'ANNULE'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];
export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  EN_ATTENTE: 'En attente', INSCRIT: 'Inscrit', ADMIS: 'Admis', AJOURNE: 'Ajourné', ANNULE: 'Annulé',
};

export const SESSION_TYPES = ['CM', 'TD', 'TP'] as const;
export type SessionType = (typeof SESSION_TYPES)[number];
