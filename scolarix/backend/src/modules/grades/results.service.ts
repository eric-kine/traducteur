import type { Prisma } from '@prisma/client';
import {
  computeRetakeFinal, computeSemester, computeUeFinal, computeYear, retainedFinal,
  type LevelResultsRow, type TranscriptUnit,
} from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import type { AuthUser } from '../../common/types';
import { assertCanManageSchool, assertSchoolAccess } from '../../common/middlewares/school-scope';

const n = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());

const enrollmentInclude = {
  student: true,
  level: true,
  specialty: true,
  academicYear: true,
  grades: true,
} as const;
type EnrollmentFull = Prisma.EnrollmentGetPayload<{ include: typeof enrollmentInclude }>;

/** UE suivies par une inscription : niveau, actives, tronc commun + UE de sa spécialité. */
async function unitsFor(e: { levelId: string; specialtyId: string | null }) {
  return prisma.teachingUnit.findMany({
    where: { levelId: e.levelId, isActive: true, OR: [{ specialtyId: null }, ...(e.specialtyId ? [{ specialtyId: e.specialtyId }] : [])] },
    orderBy: [{ semester: 'asc' }, { code: 'asc' }],
  });
}

/**
 * Calcule tous les résultats d'une inscription à partir des notes enregistrées,
 * avec les règles partagées (packages/shared/src/calc/grades.ts).
 */
export async function computeEnrollment(e: EnrollmentFull) {
  const units = await unitsFor(e);
  const rows = units.map((u): TranscriptUnit & { semester: number } => {
    const w = { ccWeight: u.ccWeight, examWeight: u.examWeight, tpWeight: u.tpWeight };
    const g1 = e.grades.find((g) => g.teachingUnitId === u.id && g.session === 'NORMALE');
    const g2 = e.grades.find((g) => g.teachingUnitId === u.id && g.session === 'RATTRAPAGE');
    const s1 = g1 ? { ccScore: n(g1.ccScore), examScore: n(g1.examScore), tpScore: n(g1.tpScore), isAbsent: g1.isAbsent } : null;
    const f1 = s1 ? computeUeFinal(w, s1) : null;
    const f2 = g2 ? computeRetakeFinal(w, s1, { ccScore: null, examScore: n(g2.examScore), tpScore: n(g2.tpScore), isAbsent: g2.isAbsent }) : null;
    const kept = retainedFinal(f1, f2);
    const fromRetake = kept.session === 'RATTRAPAGE';
    return {
      semester: u.semester,
      code: u.code,
      title: u.title,
      credits: u.credits,
      coefficient: u.coefficient.toNumber(),
      ccScore: s1?.ccScore ?? null,
      examScore: fromRetake ? n(g2!.examScore) : (s1?.examScore ?? null),
      tpScore: fromRetake && g2!.tpScore !== null ? n(g2!.tpScore) : (s1?.tpScore ?? null),
      isAbsent: fromRetake ? g2!.isAbsent : (s1?.isAbsent ?? false),
      final: kept.final,
      session: kept.session,
      status: 'INC',
      creditsEarned: 0,
    };
  });

  const semesters = [1, 2]
    .map((number) => {
      const r = computeSemester(rows.filter((u) => u.semester === number));
      return { number, average: r.average, totalCredits: r.totalCredits, creditsEarned: r.creditsEarned, units: r.units };
    })
    .filter((s) => s.units.length > 0);
  return { semesters, year: computeYear(semesters) };
}

const loadEnrollment = async (where: Prisma.EnrollmentWhereInput) => prisma.enrollment.findFirst({ where, include: enrollmentInclude });

export async function getEnrollmentResults(user: AuthUser, enrollmentId: string) {
  const e = await loadEnrollment({ id: enrollmentId });
  if (!e) throw AppError.notFound('Inscription introuvable');
  assertSchoolAccess(user, e.student.schoolId);
  return { enrollmentId, deliberatedAt: e.deliberatedAt?.toISOString() ?? null, ...(await computeEnrollment(e)) };
}

export { loadEnrollment };

async function levelOrFail(levelId: string) {
  const level = await prisma.level.findUnique({ where: { id: levelId }, select: { id: true, schoolId: true, code: true, name: true } });
  if (!level) throw AppError.notFound('Niveau introuvable');
  return level;
}

/** Tableau des résultats de tous les inscrits d'un niveau pour une année. */
export async function levelResults(user: AuthUser, levelId: string, academicYearId: string): Promise<LevelResultsRow[]> {
  const level = await levelOrFail(levelId);
  assertSchoolAccess(user, level.schoolId);
  const enrollments = await prisma.enrollment.findMany({
    where: { levelId, academicYearId, status: { not: 'ANNULE' } },
    include: enrollmentInclude,
    orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
  });
  const rows: LevelResultsRow[] = [];
  for (const e of enrollments) {
    const r = await computeEnrollment(e);
    rows.push({
      enrollmentId: e.id,
      student: { id: e.student.id, matricule: e.student.matricule, firstName: e.student.firstName, lastName: e.student.lastName },
      semesters: r.semesters.map(({ number, average, creditsEarned, totalCredits }) => ({ number, average, creditsEarned, totalCredits })),
      year: r.year,
      deliberatedAt: e.deliberatedAt?.toISOString() ?? null,
    });
  }
  return rows;
}

/**
 * Délibération d'un niveau : fige moyenne, crédits, décision et mention sur
 * chaque inscription et verrouille toutes les notes. Refusée si un résultat est incomplet.
 */
export async function deliberate(user: AuthUser, levelId: string, academicYearId: string) {
  const level = await levelOrFail(levelId);
  assertCanManageSchool(user, level.schoolId);
  const rows = await levelResults(user, levelId, academicYearId);
  if (!rows.length) throw AppError.badRequest('Aucun étudiant inscrit à ce niveau pour cette année');
  const incomplete = rows.filter((r) => r.year.decision === 'INCOMPLET');
  if (incomplete.length) {
    const names = incomplete.slice(0, 5).map((r) => `${r.student.lastName} ${r.student.firstName}`).join(', ');
    throw AppError.badRequest(`Notes manquantes pour ${incomplete.length} étudiant(s) : ${names}${incomplete.length > 5 ? '…' : ''}`);
  }
  const now = new Date();
  await prisma.$transaction([
    ...rows.map((r) =>
      prisma.enrollment.update({
        where: { id: r.enrollmentId },
        data: {
          finalAverage: r.year.average,
          creditsEarned: r.year.creditsEarned,
          decision: r.year.decision,
          mention: r.year.mention,
          deliberatedAt: now,
          status: r.year.decision === 'AJOURNE' ? 'AJOURNE' : 'ADMIS',
        },
      }),
    ),
    prisma.grade.updateMany({ where: { enrollmentId: { in: rows.map((r) => r.enrollmentId) } }, data: { isLocked: true } }),
  ]);
  return { deliberated: rows.length, admitted: rows.filter((r) => r.year.decision !== 'AJOURNE').length };
}

/** Réouverture (ADMIN) : déverrouille les notes pour corriger une erreur. */
export async function reopen(levelId: string, academicYearId: string) {
  await levelOrFail(levelId);
  const ids = (await prisma.enrollment.findMany({ where: { levelId, academicYearId }, select: { id: true } })).map((e) => e.id);
  await prisma.$transaction([
    prisma.enrollment.updateMany({
      where: { id: { in: ids } },
      data: { deliberatedAt: null, decision: null, mention: null, finalAverage: null, creditsEarned: null, status: 'INSCRIT' },
    }),
    prisma.grade.updateMany({ where: { enrollmentId: { in: ids } }, data: { isLocked: false } }),
  ]);
  return { reopened: ids.length };
}
