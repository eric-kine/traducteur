import type { DashboardAlert, DashboardDto } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import type { AuthUser } from '../../common/types';
import { getSchoolScope } from '../../common/middlewares/school-scope';

const MAX_ITEMS = 6;
const list = (items: string[]) => items.slice(0, MAX_ITEMS).concat(items.length > MAX_ITEMS ? [`… et ${items.length - MAX_ITEMS} autre(s)`] : []);

/**
 * Tableau de bord : indicateurs + alertes calculées sur l'année courante.
 * Un agent de scolarité rattaché à une école ne voit que son école.
 */
export async function getDashboard(user: AuthUser): Promise<DashboardDto> {
  const scope = getSchoolScope(user);
  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  const school = scope ? { schoolId: scope } : {};
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [schools, levels, students, teachers, teachingUnits, enrollments, certificates30d, transcripts30d, users] = await Promise.all([
    prisma.school.count({ where: { isActive: true, ...(scope && { id: scope }) } }),
    prisma.level.count({ where: school }),
    prisma.student.count({ where: { status: 'ACTIF', ...school } }),
    prisma.teacher.count({ where: { isActive: true } }),
    prisma.teachingUnit.count({ where: { isActive: true, level: school } }),
    year ? prisma.enrollment.count({ where: { academicYearId: year.id, status: { not: 'ANNULE' }, student: school } }) : 0,
    prisma.certificate.count({ where: { issuedAt: { gte: since }, student: school } }),
    prisma.generatedDocument.count({ where: { type: 'RELEVE_NOTES', issuedAt: { gte: since }, student: school } }),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  const schoolRows = await prisma.school.findMany({
    where: { isActive: true, ...(scope && { id: scope }) },
    orderBy: { code: 'asc' },
    include: { _count: { select: { students: true, levels: true } }, levels: { include: { _count: { select: { teachingUnits: true } } } } },
  });
  const enrollByLevel = year
    ? await prisma.enrollment.groupBy({ by: ['levelId'], where: { academicYearId: year.id, status: { not: 'ANNULE' }, student: school }, _count: true })
    : [];
  const bySchool = schoolRows.map((s) => ({
    code: s.code, name: s.name, students: s._count.students, levels: s._count.levels,
    teachingUnits: s.levels.reduce((a, l) => a + l._count.teachingUnits, 0),
    enrollments: enrollByLevel.filter((e) => s.levels.some((l) => l.id === e.levelId)).reduce((a, e) => a + e._count, 0),
  }));
  const byLevel = schoolRows.flatMap((s) => s.levels.map((l) => ({ school: s.code, level: l.code, enrollments: enrollByLevel.find((e) => e.levelId === l.id)?._count ?? 0 }))).filter((r) => r.enrollments > 0);

  const alerts: DashboardAlert[] = [];
  if (!year) {
    alerts.push({ key: 'no_year', severity: 'warning', title: "Aucune année académique courante", count: 1, items: ['Créez ou choisissez l’année en cours'], link: '/admin?tab=years' });
  } else {
    // 1. UE dont les heures ne sont pas entièrement affectées
    const units = await prisma.teachingUnit.findMany({
      where: { isActive: true, level: school },
      include: { level: { include: { school: true } }, assignments: { where: { academicYearId: year.id } }, syllabi: { where: { academicYearId: year.id } } },
      orderBy: { code: 'asc' },
    });
    const uncovered: string[] = [];
    const noCoordinator: string[] = [];
    const noSyllabus: string[] = [];
    for (const u of units) {
      for (const [t, f] of [['CM', 'cmHours'], ['TD', 'tdHours'], ['TP', 'tpHours']] as const) {
        const quota = u[f].toNumber();
        const done = u.assignments.filter((a) => a.sessionType === t).reduce((s, a) => s + a.assignedHours.toNumber(), 0);
        if (quota > 0 && done < quota) uncovered.push(`${u.level.school.code} ${u.level.code} · ${u.code} ${t} : ${done}/${quota} h affectées`);
      }
      if (u.assignments.length && !u.assignments.some((a) => a.isCoordinator)) noCoordinator.push(`${u.level.school.code} ${u.level.code} · ${u.code}`);
      if (!u.syllabi.length) noSyllabus.push(`${u.level.school.code} ${u.level.code} · ${u.code}`);
    }
    if (uncovered.length) alerts.push({ key: 'uncovered_hours', severity: 'warning', title: 'Heures d’enseignement non affectées', count: uncovered.length, items: list(uncovered), link: '/teachers' });
    if (noCoordinator.length) alerts.push({ key: 'no_coordinator', severity: 'info', title: 'UE sans enseignant responsable', count: noCoordinator.length, items: list(noCoordinator), link: '/teachers' });

    // 2. Étudiants actifs non inscrits cette année ; inscriptions en attente
    const notEnrolled = await prisma.student.findMany({ where: { status: 'ACTIF', ...school, enrollments: { none: { academicYearId: year.id } } }, take: 50, orderBy: { lastName: 'asc' } });
    if (notEnrolled.length) alerts.push({ key: 'not_enrolled', severity: 'warning', title: `Étudiants actifs non inscrits en ${year.label}`, count: notEnrolled.length, items: list(notEnrolled.map((s) => `${s.lastName.toUpperCase()} ${s.firstName} (${s.matricule})`)), link: '/students' });
    const pending = await prisma.enrollment.count({ where: { academicYearId: year.id, status: 'EN_ATTENTE', student: school } });
    if (pending) alerts.push({ key: 'pending', severity: 'info', title: 'Inscriptions en attente de validation', count: pending, items: [], link: '/students' });

    // 3. Notes manquantes (niveaux pas encore délibérés)
    const missing: string[] = [];
    for (const u of units) {
      const where = { levelId: u.levelId, academicYearId: year.id, status: { not: 'ANNULE' as const }, deliberatedAt: null, ...(u.specialtyId && { specialtyId: u.specialtyId }) };
      const [expected, entered] = await Promise.all([
        prisma.enrollment.count({ where }),
        prisma.grade.count({ where: { teachingUnitId: u.id, session: 'NORMALE', finalScore: { not: null }, enrollment: where } }),
      ]);
      if (expected > entered) missing.push(`${u.level.school.code} ${u.level.code} · ${u.code} : ${expected - entered} note(s) sur ${expected}`);
    }
    if (missing.length) alerts.push({ key: 'grades_missing', severity: 'info', title: 'Notes encore à saisir', count: missing.length, items: list(missing) });

    // 4. Emplois du temps : manquants, brouillons, séances non placées
    const levelsWithUnits = await prisma.level.findMany({ where: { ...school, teachingUnits: { some: { isActive: true } } }, include: { school: true, schedules: { where: { academicYearId: year.id } }, teachingUnits: { where: { isActive: true }, select: { semester: true } } } });
    const ttIssues: string[] = [];
    for (const l of levelsWithUnits) {
      for (const sem of [...new Set(l.teachingUnits.map((u) => u.semester))].sort()) {
        const s = l.schedules.find((x) => x.semester === sem);
        const unplaced = (s?.generationReport as { unplaced?: unknown[] } | null)?.unplaced?.length ?? 0;
        if (!s) ttIssues.push(`${l.school.code} ${l.code} S${sem} : pas encore généré`);
        else if (unplaced) ttIssues.push(`${l.school.code} ${l.code} S${sem} : ${unplaced} séance(s) non placée(s)`);
        else if (s.status !== 'PUBLIE') ttIssues.push(`${l.school.code} ${l.code} S${sem} : brouillon non publié`);
      }
    }
    if (ttIssues.length) alerts.push({ key: 'timetables', severity: 'info', title: 'Emplois du temps à finaliser', count: ttIssues.length, items: list(ttIssues), link: '/timetables' });

    if (noSyllabus.length) alerts.push({ key: 'no_syllabus', severity: 'info', title: `UE sans syllabus pour ${year.label}`, count: noSyllabus.length, items: list(noSyllabus) });
  }

  // 5. Comptes : enseignants sans accès
  const teachersWithoutAccount = await prisma.teacher.count({ where: { isActive: true, userId: null } });
  if (teachersWithoutAccount) alerts.push({ key: 'teacher_accounts', severity: 'info', title: 'Enseignants sans compte de connexion', count: teachersWithoutAccount, items: ['Ils ne peuvent pas saisir leurs notes en ligne'], link: '/teachers' });

  return {
    academicYear: year ? { id: year.id, label: year.label } : null,
    scope: scope ? schoolRows[0]?.code ?? null : null,
    kpis: { schools, levels, students, teachers, teachingUnits, enrollments, certificates30d, transcripts30d, users },
    bySchool, byLevel, alerts,
  };
}
