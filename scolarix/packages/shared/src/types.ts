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
