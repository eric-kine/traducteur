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
