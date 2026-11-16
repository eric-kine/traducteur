import type { MyCourseStudents, MyStudentSpace, MyTeacherSpace, TimetableView } from '@scolarix/shared';
import { WEEKDAYS } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import type { AuthUser } from '../../common/types';
import { toDto as studentDto } from '../students/students.service';
import { toDto as enrollmentDto, enrollmentInclude } from '../enrollments/enrollments.service';
import { toDto as teacherDto, serviceSummary } from '../teachers/teachers.service';
import { computeEnrollment, loadEnrollment } from '../grades/results.service';
import { issueTranscript } from '../grades/transcript.service';
import * as certificates from '../certificates/certificates.service';
import { getTimeslots, sessionInclude, teacherView, toView } from '../schedules/schedules.service';

// ═══════════════════════ Fiches reliées au compte ═══════════════════════

async function myStudent(user: AuthUser) {
  if (user.role !== 'ETUDIANT') throw AppError.forbidden('Réservé aux étudiants');
  const s = await prisma.student.findUnique({ where: { userId: user.id } });
  if (!s) throw AppError.notFound("Aucune fiche étudiant n'est reliée à votre compte : contactez la scolarité");
  return s;
}

async function myTeacher(user: AuthUser) {
  if (user.role !== 'ENSEIGNANT') throw AppError.forbidden('Réservé aux enseignants');
  const t = await prisma.teacher.findUnique({ where: { userId: user.id } });
  if (!t) throw AppError.notFound("Aucune fiche enseignant n'est reliée à votre compte : contactez la scolarité");
  return t;
}

const currentYear = () => prisma.academicYear.findFirst({ where: { isCurrent: true } });

// ═══════════════════════ Espace étudiant ═══════════════════════

export async function studentSpace(user: AuthUser): Promise<MyStudentSpace> {
  const s = await myStudent(user);
  const full = await prisma.student.findUniqueOrThrow({
    where: { id: s.id },
    include: {
      school: { select: { id: true, code: true, name: true } },
      enrollments: { include: enrollmentInclude, orderBy: { academicYear: { startDate: 'desc' } } },
    },
  });
  return {
    student: studentDto({ ...full, enrollments: full.enrollments.slice(0, 1) }),
    enrollments: full.enrollments.map((e) => ({ ...enrollmentDto(e), deliberated: !!e.deliberatedAt })),
  };
}

async function myEnrollment(user: AuthUser, yearLabel: string) {
  const s = await myStudent(user);
  const e = await loadEnrollment({ studentId: s.id, academicYear: { label: yearLabel } });
  if (!e) throw AppError.notFound(`Aucune inscription pour ${yearLabel}`);
  return { s, e };
}

/** Notes et résultats (provisoires tant que la délibération n'a pas eu lieu). */
export async function myResults(user: AuthUser, yearLabel: string) {
  const { e } = await myEnrollment(user, yearLabel);
  return { academicYear: yearLabel, deliberatedAt: e.deliberatedAt?.toISOString() ?? null, ...(await computeEnrollment(e)) };
}

/** Relevé officiel : seulement après délibération. */
export async function myTranscript(user: AuthUser, yearLabel: string) {
  const { s, e } = await myEnrollment(user, yearLabel);
  if (!e.deliberatedAt) throw AppError.forbidden('Le relevé officiel sera disponible après la délibération');
  return issueTranscript(user, s.id, yearLabel, 'pdf') as Promise<{ pdf: Buffer; filename: string; reference: string }>;
}

/**
 * Certificat en libre-service. Pour éviter les numéros inutiles, si un certificat
 * valide a été émis pour cette année dans les dernières 24 h, on renvoie son duplicata.
 */
export async function myCertificate(user: AuthUser, yearLabel: string) {
  const s = await myStudent(user);
  const recent = await prisma.certificate.findFirst({
    where: { studentId: s.id, status: 'VALIDE', academicYear: { label: yearLabel }, issuedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    orderBy: { issuedAt: 'desc' },
  });
  if (recent) {
    const d = await certificates.duplicate(user, recent.id);
    return { pdf: d.pdf, filename: d.filename, number: recent.number, reused: true };
  }
  const issued = await certificates.issueForSelf(user, s.id, yearLabel);
  return { pdf: issued.pdf, filename: issued.filename, number: issued.number, reused: false };
}

export async function myCertificates(user: AuthUser) {
  const s = await myStudent(user);
  return (await certificates.list({ id: user.id, email: user.email, role: 'ADMIN', schoolId: null }, { studentId: s.id, page: 1, pageSize: 100 })).data;
}

export async function myCertificatePdf(user: AuthUser, id: string) {
  const s = await myStudent(user);
  const c = await prisma.certificate.findUnique({ where: { id } });
  if (!c || c.studentId !== s.id) throw AppError.notFound('Certificat introuvable');
  return certificates.duplicate(user, id);
}

/** Emploi du temps PUBLIÉ du niveau, limité au tronc commun et à la spécialité de l'étudiant. */
async function studentTimetable(user: AuthUser, semester: number): Promise<TimetableView | null> {
  const s = await myStudent(user);
  const year = await currentYear();
  if (!year) return null;
  const e = await prisma.enrollment.findUnique({ where: { studentId_academicYearId: { studentId: s.id, academicYearId: year.id } }, include: { level: true } });
  if (!e) return null;
  const sched = await prisma.schedule.findUnique({ where: { academicYearId_levelId_semester: { academicYearId: year.id, levelId: e.levelId, semester } } });
  if (!sched || sched.status !== 'PUBLIE') return null;
  const sessions = await prisma.scheduleSession.findMany({
    where: { scheduleId: sched.id, OR: [{ audienceSpecialtyId: null }, ...(e.specialtyId ? [{ audienceSpecialtyId: e.specialtyId }] : [])] },
    include: sessionInclude,
  });
  return {
    kind: 'level', title: `${e.level.name} (${e.level.code})`, subtitle: `Semestre ${semester} · ${year.label}`,
    days: [...WEEKDAYS], slots: await getTimeslots(), sessions: sessions.map(toView), schedule: null,
  };
}

// ═══════════════════════ Espace enseignant ═══════════════════════

export async function teacherSpace(user: AuthUser, academicYearId?: string): Promise<MyTeacherSpace> {
  const t = await myTeacher(user);
  const year = academicYearId ? await prisma.academicYear.findUnique({ where: { id: academicYearId } }) : await currentYear();
  if (!year) return { teacher: teacherDto(t), academicYear: null, courses: [], service: null };

  const assignments = await prisma.teachingAssignment.findMany({
    where: { teacherId: t.id, academicYearId: year.id },
    include: { teachingUnit: { include: { level: { include: { school: true } }, specialty: true } } },
    orderBy: [{ teachingUnit: { semester: 'asc' } }, { teachingUnit: { code: 'asc' } }],
  });
  const byUe = new Map<string, MyTeacherSpace['courses'][number]>();
  for (const a of assignments) {
    const u = a.teachingUnit;
    const c = byUe.get(u.id) ?? {
      teachingUnit: {
        id: u.id, code: u.code, title: u.title, semester: u.semester, credits: u.credits,
        level: { id: u.level.id, code: u.level.code, name: u.level.name }, school: { code: u.level.school.code }, specialty: u.specialty?.code ?? null,
      },
      sessionTypes: [], assignedHours: 0, completedHours: 0, isCoordinator: false, students: 0, gradesEntered: 0,
    };
    c.sessionTypes.push(a.sessionType);
    c.assignedHours += a.assignedHours.toNumber();
    c.completedHours += a.completedHours.toNumber();
    c.isCoordinator ||= a.isCoordinator;
    byUe.set(u.id, c);
  }
  for (const [ueId, c] of byUe) {
    const u = assignments.find((a) => a.teachingUnitId === ueId)!.teachingUnit;
    const where = { levelId: u.levelId, academicYearId: year.id, status: { not: 'ANNULE' as const }, ...(u.specialtyId && { specialtyId: u.specialtyId }) };
    [c.students, c.gradesEntered] = await Promise.all([
      prisma.enrollment.count({ where }),
      prisma.grade.count({ where: { teachingUnitId: ueId, session: 'NORMALE', finalScore: { not: null }, enrollment: where } }),
    ]);
  }
  return { teacher: teacherDto(t), academicYear: { id: year.id, label: year.label }, courses: [...byUe.values()], service: await serviceSummary(t.id, year.id) };
}

/** Liste des étudiants d'une de SES UE. */
export async function courseStudents(user: AuthUser, ueId: string, academicYearId: string): Promise<MyCourseStudents> {
  const t = await myTeacher(user);
  const a = await prisma.teachingAssignment.findFirst({ where: { teacherId: t.id, teachingUnitId: ueId, academicYearId }, include: { teachingUnit: true } });
  if (!a) throw AppError.forbidden("Vous n'êtes pas affecté à cette UE");
  const u = a.teachingUnit;
  const rows = await prisma.enrollment.findMany({
    where: { levelId: u.levelId, academicYearId, status: { not: 'ANNULE' }, ...(u.specialtyId && { specialtyId: u.specialtyId }) },
    include: { student: true, specialty: true },
    orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
  });
  return {
    teachingUnit: { id: u.id, code: u.code, title: u.title },
    students: rows.map((e) => ({ matricule: e.student.matricule, firstName: e.student.firstName, lastName: e.student.lastName, specialty: e.specialty?.code ?? null, email: e.student.email })),
  };
}

// ═══════════════════════ Emploi du temps personnel ═══════════════════════

export async function myTimetable(user: AuthUser, semester: number): Promise<TimetableView | null> {
  if (user.role === 'ETUDIANT') return studentTimetable(user, semester);
  const t = await myTeacher(user);
  const year = await currentYear();
  return year ? teacherView(t.id, year.id, semester, true) : null;
}
