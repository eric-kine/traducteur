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
  unavailability: { day: import('./schemas/schedule.schema').Weekday; start: string }[];
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

export interface GradeSheetRow {
  enrollmentId: string;
  student: { id: string; matricule: string; firstName: string; lastName: string };
  specialty: string | null;
  ccScore: number | null;
  examScore: number | null;
  tpScore: number | null;
  isAbsent: boolean;
  comment: string | null;
  finalScore: number | null;
  /** Rattrapage : notes de la session normale (CC conservé) */
  normal?: { ccScore: number | null; examScore: number | null; tpScore: number | null; isAbsent: boolean; finalScore: number | null } | null;
}

export interface GradeSheet {
  teachingUnit: { id: string; code: string; title: string; semester: number; credits: number; coefficient: number; ccWeight: number; examWeight: number; tpWeight: number; levelId: string };
  academicYear: { id: string; label: string };
  session: 'NORMALE' | 'RATTRAPAGE';
  locked: boolean;
  canEdit: boolean;
  rows: GradeSheetRow[];
}

export interface TranscriptUnit {
  code: string;
  title: string;
  credits: number;
  coefficient: number;
  ccScore: number | null;
  examScore: number | null;
  tpScore: number | null;
  isAbsent: boolean;
  final: number | null;
  session: 'NORMALE' | 'RATTRAPAGE' | null;
  status: import('./calc/grades').UeStatus;
  creditsEarned: number;
}

export interface TranscriptData {
  reference: string | null;
  verificationCode: string | null;
  issuedAt: string;
  institute: { name: string; acronym: string | null; address: string | null; city: string | null; country: string | null; phone: string | null; email: string | null; website: string | null; directorName: string | null };
  school: { code: string; name: string; directorName: string | null };
  student: { matricule: string; firstName: string; lastName: string; birthDate: string; birthPlace: string; gender: 'M' | 'F' };
  academicYear: string;
  level: { code: string; name: string };
  specialty: { code: string; name: string; diplomaTitle: string | null } | null;
  semesters: { number: number; average: number | null; totalCredits: number; creditsEarned: number; units: TranscriptUnit[] }[];
  year: import('./calc/grades').YearResult;
  deliberatedAt: string | null;
  isProvisional: boolean;
}

export interface LevelResultsRow {
  enrollmentId: string;
  student: { id: string; matricule: string; firstName: string; lastName: string };
  semesters: { number: number; average: number | null; creditsEarned: number; totalCredits: number }[];
  year: import('./calc/grades').YearResult;
  deliberatedAt: string | null;
}

/** Données imprimées sur un certificat (et figées dans Certificate.snapshot). */
export interface CertificateData {
  number: string;
  orderNumber: number;
  verificationCode: string | null;
  verificationUrl: string | null;
  issuedAt: string;
  purpose: string | null;
  institute: TranscriptData['institute'];
  school: TranscriptData['school'];
  student: TranscriptData['student'] & { nationality: string | null };
  academicYear: { label: string; startDate: string; endDate: string };
  level: { code: string; name: string; cycle: string };
  specialty: { code: string; name: string; diplomaTitle: string | null } | null;
  isRepeating: boolean;
  /** L'année est terminée → "était régulièrement inscrit(e)" */
  isPastYear: boolean;
}

export interface CertificateDto {
  id: string;
  number: string;
  orderNumber: number;
  verificationCode: string;
  purpose: string | null;
  status: 'VALIDE' | 'ANNULE';
  issuedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  issuedBy: string | null;
  student: { id: string; matricule: string; firstName: string; lastName: string };
  school: { code: string; name: string };
  level: string;
  specialty: string | null;
  academicYear: string;
}

/** Réponse de la vérification publique d'un document (informations minimales). */
export interface VerificationResult {
  valid: boolean;
  type: 'CERTIFICAT_SCOLARITE' | 'RELEVE_NOTES';
  reference: string;
  status: 'VALIDE' | 'ANNULE';
  issuedAt: string;
  revokedAt: string | null;
  student: { fullName: string; matricule: string };
  school: string;
  institute: string;
  level: string;
  academicYear: string;
}

export interface SyllabusTeacher {
  title: string | null;
  firstName: string;
  lastName: string;
  email: string;
  grade: string | null;
  sessionTypes: import('./enums').SessionType[];
  isCoordinator: boolean;
}

/** Tout ce qu'il faut pour éditer ou imprimer le syllabus d'une UE pour une année. */
export interface SyllabusDto {
  academicYear: { id: string; label: string };
  exists: boolean;
  status: 'BROUILLON' | 'PUBLIE' | 'ARCHIVE';
  updatedAt: string | null;
  updatedBy: string | null;
  canEdit: boolean;
  teachingUnit: {
    id: string; code: string; title: string; description: string | null; semester: number; credits: number; coefficient: number;
    cmHours: number; tdHours: number; tpHours: number; totalHours: number; ccWeight: number; examWeight: number; tpWeight: number;
    objectives: string | null; prerequisites: string | null; bibliography: string | null;
  };
  level: { id: string; code: string; name: string };
  specialty: { code: string; name: string } | null;
  school: { code: string; name: string; directorName: string | null };
  institute: { name: string; acronym: string | null; city: string | null; country: string | null; email: string | null; phone: string | null; address: string | null };
  teachers: SyllabusTeacher[];
  /** Champs complémentaires (null = non renseigné ; pour objectifs/prérequis/bibliographie, le texte de l'UE est utilisé) */
  fields: {
    objectives: string | null;
    competencies: string | null;
    prerequisites: string | null;
    content: { title: string; sessionType: import('./enums').SessionType | null; hours: number | null; description: string | null }[];
    teachingMethods: string | null;
    evaluationMethods: string | null;
    bibliography: string | null;
  };
}

export interface RoomDto {
  id: string; code: string; name: string | null; building: string | null; capacity: number;
  supportedTypes: import('./enums').SessionType[]; isActive: boolean;
  unavailability: import('./schemas/schedule.schema').Unavailability;
}
export interface TimeslotDto { id: string; order: number; startTime: string; endTime: string }

export interface SessionView {
  id: string;
  scheduleId: string;
  day: import('./schemas/schedule.schema').Weekday;
  timeslotId: string;
  sessionType: import('./enums').SessionType;
  locked: boolean;
  teachingUnit: { id: string; code: string; title: string };
  teacher: { id: string; name: string } | null;
  room: { id: string; code: string; capacity: number } | null;
  audience: { id: string; code: string } | null; // null = tronc commun
  level: { id: string; code: string; name: string };
  school: { code: string };
}

export interface ScheduleReport {
  strategy: 'backtracking' | 'glouton';
  steps: number;
  total: number;
  placed: number;
  unplaced: { teachingUnit: string; sessionType: string; teacher: string | null; audience: string | null; reason: string }[];
  warnings: string[];
  coverage: { teachingUnit: string; sessionType: string; quotaHours: number; weeklySessions: number; plannedHours: number }[];
}

export interface ScheduleDto {
  id: string;
  semester: number;
  weeks: number;
  status: 'BROUILLON' | 'PUBLIE' | 'ARCHIVE';
  generatedAt: string | null;
  report: ScheduleReport | null;
  academicYear: { id: string; label: string };
  level: { id: string; code: string; name: string; schoolId: string };
  canEdit: boolean;
}

/** Grille hebdomadaire prête à afficher (niveau, enseignant ou salle). */
export interface TimetableView {
  kind: 'level' | 'teacher' | 'room';
  title: string;
  subtitle: string;
  days: import('./schemas/schedule.schema').Weekday[];
  slots: TimeslotDto[];
  sessions: SessionView[];
  schedule?: ScheduleDto | null;
}
