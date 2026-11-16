import type { Role } from './enums';

/** Utilisateur tel que renvoyé par l'API (jamais de mot de passe). */
export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  schoolId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: UserDto;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Format unique des erreurs renvoyées par l'API. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface InstituteDto {
  id: string;
  name: string;
  acronym: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  directorName: string | null;
  updatedAt: string;
}

export interface SchoolDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  directorName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { specialties: number; levels: number; students: number };
}

export interface SpecialtyDto {
  id: string;
  schoolId: string;
  code: string;
  name: string;
  description: string | null;
  diplomaTitle: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface LevelDto {
  id: string;
  schoolId: string;
  code: string;
  name: string;
  cycle: import('./enums').LevelCycle;
  order: number;
  requiredCredits: number;
  createdAt: string;
}

export interface TeachingUnitDto {
  id: string;
  levelId: string;
  specialtyId: string | null;
  specialty: { id: string; code: string; name: string } | null;
  code: string;
  title: string;
  description: string | null;
  semester: number;
  credits: number;
  coefficient: number;
  cmHours: number;
  tdHours: number;
  tpHours: number;
  totalHours: number;
  paidHours: number;
  paidHoursAuto: boolean;
  hourlyRate: number | null;
  /** paidHours × hourlyRate (calculé par l'API) */
  estimatedCost: number | null;
  ccWeight: number;
  examWeight: number;
  tpWeight: number;
  objectives: string | null;
  prerequisites: string | null;
  bibliography: string | null;
  isActive: boolean;
  createdAt: string;
}

/** Totaux d'une maquette (par semestre et pour l'année). */
export interface TeachingUnitTotals {
  count: number;
  credits: number;
  cmHours: number;
  tdHours: number;
  tpHours: number;
  totalHours: number;
  paidHours: number;
  estimatedCost: number;
}

export interface TeachingUnitListResponse {
  data: TeachingUnitDto[];
  totals: { semester1: TeachingUnitTotals; semester2: TeachingUnitTotals; year: TeachingUnitTotals };
  level: { id: string; code: string; name: string; requiredCredits: number; schoolId: string };
}

export interface AcademicYearDto {
  id: string;
  label: string;
  startDate: string; // AAAA-MM-JJ
  endDate: string;
  isCurrent: boolean;
  _count?: { enrollments: number; assignments: number };
}

export interface EnrollmentDto {
  id: string;
  studentId: string;
  status: import('./enums').EnrollmentStatus;
  isRepeating: boolean;
  enrolledAt: string;
  academicYear: { id: string; label: string };
  level: { id: string; code: string; name: string };
  specialty: { id: string; code: string; name: string } | null;
  student?: { id: string; matricule: string; firstName: string; lastName: string };
}

export interface StudentDto {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  gender: import('./enums').Gender;
  birthDate: string; // AAAA-MM-JJ
  birthPlace: string;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  hasPhoto: boolean;
  status: import('./enums').StudentStatus;
  guardianName: string | null;
  guardianRelation: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  school: { id: string; code: string; name: string };
  /** Inscription la plus récente */
  currentEnrollment: EnrollmentDto | null;
  createdAt: string;
}

export interface ImportRowResult {
  line: number; // numéro de ligne dans le fichier (en-tête = 1)
  status: 'ok' | 'error' | 'duplicate';
  name: string;
  errors: string[];
  matricule?: string;
}
export interface ImportReport {
  dryRun: boolean;
  total: number;
  valid: number;
  errors: number;
  duplicates: number;
  imported: number;
  rows: ImportRowResult[];
}

export interface TeacherDto {
  id: string;
  employeeNumber: string;
  title: string | null;
  firstName: string;
  lastName: string;
  grade: string | null;
  specialtyField: string | null;
  email: string;
  phone: string | null;
  status: import('./enums').TeacherStatus;
  hourlyRate: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface AssignmentDto {
  id: string;
  sessionType: import('./enums').SessionType;
  assignedHours: number;
  completedHours: number;
  isCoordinator: boolean;
  academicYear: { id: string; label: string };
  teacher: { id: string; employeeNumber: string; title: string | null; firstName: string; lastName: string; hourlyRate: number | null };
  teachingUnit: {
    id: string; code: string; title: string; semester: number;
    level: { id: string; code: string; name: string; school: { id: string; code: string; name: string } };
  };
}

/** Couverture d'une UE pour une année : quota, heures affectées, reste à affecter. */
export interface CoverageDto {
  teachingUnitId: string;
  academicYearId: string;
  byType: Record<import('./enums').SessionType, { quota: number; assigned: number; completed: number; remaining: number }>;
}

/** Service d'un enseignant pour une année. */
export interface TeacherServiceSummary {
  assigned: Record<import('./enums').SessionType, number>;
  completed: Record<import('./enums').SessionType, number>;
  assignedTotal: number;
  completedTotal: number;
  /** Heures assurées converties en équivalent TD */
  completedTdEquivalent: number;
  hourlyRate: number | null;
  /** completedTdEquivalent × taux horaire de l'enseignant */
  amountDue: number | null;
}
