import type { Response } from 'express';
import archiver from 'archiver';
import type { SessionType } from '@prisma/client';
import type { z } from 'zod';
import type { levelSyllabiQuerySchema, saveSyllabusSchema, SyllabusDto } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import type { AuthUser } from '../../common/types';
import { assertSchoolAccess } from '../../common/middlewares/school-scope';
import { htmlToPdf } from '../../pdf/pdf.service';
import { renderSyllabus } from '../../pdf/templates/syllabus';

/** Année demandée (libellé) ou, à défaut, l'année courante. */
async function resolveYear(label?: string) {
  const year = label
    ? await prisma.academicYear.findFirst({ where: { label } })
    : await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  if (!year) throw AppError.notFound(label ? `Année ${label} introuvable` : "Aucune année courante : précisez l'année (?year=2026-2027)");
  return year;
}

/**
 * Droit de rédiger le syllabus : ADMIN, SCOLARITE de l'école, ou l'ENSEIGNANT
 * responsable de l'UE pour cette année (compte relié à sa fiche enseignant).
 */
async function canEdit(user: AuthUser, unitId: string, schoolId: string, academicYearId: string) {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'SCOLARITE') return user.schoolId === null || user.schoolId === schoolId;
  if (user.role === 'ENSEIGNANT') {
    return !!(await prisma.teachingAssignment.findFirst({
      where: { teachingUnitId: unitId, academicYearId, isCoordinator: true, teacher: { userId: user.id } },
      select: { id: true },
    }));
  }
  return false;
}

const num = (d: { toNumber(): number }) => d.toNumber();

/** Assemble toutes les données du syllabus (UE + enseignants + champs complémentaires). */
export async function getSyllabus(user: AuthUser, unitId: string, yearLabel?: string): Promise<SyllabusDto> {
  const unit = await prisma.teachingUnit.findUnique({
    where: { id: unitId },
    include: { level: { include: { school: true } }, specialty: true },
  });
  if (!unit) throw AppError.notFound('UE introuvable');
  assertSchoolAccess(user, unit.level.schoolId);
  const year = await resolveYear(yearLabel);

  const [syllabus, assignments, institute] = await Promise.all([
    prisma.syllabus.findUnique({
      where: { teachingUnitId_academicYearId: { teachingUnitId: unitId, academicYearId: year.id } },
      include: { updatedBy: { select: { firstName: true, lastName: true } } },
    }),
    prisma.teachingAssignment.findMany({
      where: { teachingUnitId: unitId, academicYearId: year.id },
      include: { teacher: true },
      orderBy: [{ isCoordinator: 'desc' }, { sessionType: 'asc' }],
    }),
    prisma.institute.findFirst({ orderBy: { createdAt: 'asc' } }),
  ]);
  if (!institute) throw AppError.badRequest("Configurez d'abord l'institut");

  // Un enseignant peut avoir plusieurs affectations (CM + TD) : on les regroupe
  const teachers = new Map<string, SyllabusDto['teachers'][number]>();
  for (const a of assignments) {
    const t = teachers.get(a.teacherId) ?? {
      title: a.teacher.title, firstName: a.teacher.firstName, lastName: a.teacher.lastName, email: a.teacher.email,
      grade: a.teacher.grade, sessionTypes: [] as SessionType[], isCoordinator: false,
    };
    t.sessionTypes.push(a.sessionType);
    t.isCoordinator ||= a.isCoordinator;
    teachers.set(a.teacherId, t);
  }

  return {
    academicYear: { id: year.id, label: year.label },
    exists: !!syllabus,
    status: syllabus?.status ?? 'BROUILLON',
    updatedAt: syllabus?.updatedAt.toISOString() ?? null,
    updatedBy: syllabus?.updatedBy ? `${syllabus.updatedBy.firstName} ${syllabus.updatedBy.lastName}` : null,
    canEdit: await canEdit(user, unitId, unit.level.schoolId, year.id),
    teachingUnit: {
      id: unit.id, code: unit.code, title: unit.title, description: unit.description, semester: unit.semester, credits: unit.credits,
      coefficient: num(unit.coefficient), cmHours: num(unit.cmHours), tdHours: num(unit.tdHours), tpHours: num(unit.tpHours),
      totalHours: num(unit.totalHours), ccWeight: unit.ccWeight, examWeight: unit.examWeight, tpWeight: unit.tpWeight,
      objectives: unit.objectives, prerequisites: unit.prerequisites, bibliography: unit.bibliography,
    },
    level: { id: unit.level.id, code: unit.level.code, name: unit.level.name },
    specialty: unit.specialty ? { code: unit.specialty.code, name: unit.specialty.name } : null,
    school: { code: unit.level.school.code, name: unit.level.school.name, directorName: unit.level.school.directorName },
    institute: {
      name: institute.name, acronym: institute.acronym, city: institute.city, country: institute.country,
      email: institute.email, phone: institute.phone, address: institute.address,
    },
    teachers: [...teachers.values()],
    fields: {
      objectives: syllabus?.objectives ?? null,
      competencies: syllabus?.competencies ?? null,
      prerequisites: syllabus?.prerequisites ?? null,
      content: (syllabus?.content as SyllabusDto['fields']['content'] | null) ?? [],
      teachingMethods: syllabus?.teachingMethods ?? null,
      evaluationMethods: syllabus?.evaluationMethods ?? null,
      bibliography: syllabus?.bibliography ?? null,
    },
  };
}

/** Enregistre les champs complémentaires (création ou mise à jour pour l'année). */
export async function saveSyllabus(user: AuthUser, unitId: string, data: z.output<typeof saveSyllabusSchema>) {
  const current = await getSyllabus(user, unitId, data.year);
  if (!current.canEdit) throw AppError.forbidden("Seuls l'administration, la scolarité de l'école et le responsable de l'UE peuvent rédiger ce syllabus");
  const { year: _y, content, ...fields } = data;
  const values = {
    ...fields,
    objectives: fields.objectives ?? null,
    competencies: fields.competencies ?? null,
    prerequisites: fields.prerequisites ?? null,
    teachingMethods: fields.teachingMethods ?? null,
    evaluationMethods: fields.evaluationMethods ?? null,
    bibliography: fields.bibliography ?? null,
    content: content.map((c) => ({ title: c.title, sessionType: c.sessionType ?? null, hours: c.hours ?? null, description: c.description ?? null })),
    updatedById: user.id,
  };
  await prisma.syllabus.upsert({
    where: { teachingUnitId_academicYearId: { teachingUnitId: unitId, academicYearId: current.academicYear.id } },
    create: { ...values, teachingUnitId: unitId, academicYearId: current.academicYear.id },
    update: values,
  });
  return getSyllabus(user, unitId, data.year);
}

const footer = (d: SyllabusDto) => `Syllabus ${d.teachingUnit.code} — ${d.teachingUnit.title} · ${d.school.code} · ${d.academicYear.label}`;

export async function renderOne(user: AuthUser, unitId: string, yearLabel: string | undefined, format: 'pdf' | 'html') {
  const d = await getSyllabus(user, unitId, yearLabel);
  const html = renderSyllabus(d);
  if (format === 'html') return { html };
  const pdf = await htmlToPdf(html, { footerText: footer(d) });
  if (d.exists) {
    await prisma.syllabus.update({
      where: { teachingUnitId_academicYearId: { teachingUnitId: unitId, academicYearId: d.academicYear.id } },
      data: { generatedAt: new Date() },
    });
  }
  return { pdf, filename: `syllabus-${d.teachingUnit.code}-${d.academicYear.label}.pdf` };
}

/**
 * Génération en lot : un PDF par UE active du niveau, envoyés dans une archive ZIP
 * construite au fil de l'eau (la mémoire reste faible même pour beaucoup d'UE).
 */
export async function streamLevelZip(user: AuthUser, levelId: string, q: z.output<typeof levelSyllabiQuerySchema>, res: Response) {
  const level = await prisma.level.findUnique({ where: { id: levelId }, include: { school: { select: { id: true, code: true } } } });
  if (!level) throw AppError.notFound('Niveau introuvable');
  assertSchoolAccess(user, level.schoolId);
  const year = await resolveYear(q.year);

  const units = await prisma.teachingUnit.findMany({
    where: {
      levelId, isActive: true,
      ...(q.semester && { semester: q.semester }),
      ...(!q.includeDrafts && { syllabi: { some: { academicYearId: year.id } } }),
    },
    orderBy: [{ semester: 'asc' }, { code: 'asc' }],
    select: { id: true, code: true },
  });
  if (!units.length) throw AppError.notFound('Aucune UE à exporter pour ce niveau');

  // Toutes les données sont préparées AVANT d'envoyer la réponse : une erreur
  // donne encore un vrai message JSON (et pas un ZIP coupé).
  const docs = await Promise.all(units.map((u) => getSyllabus(user, u.id, year.label)));

  const zipName = `syllabus-${level.school.code}-${level.code}-${year.label}.zip`;
  res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${zipName}"`, 'Cache-Control': 'no-store', 'X-Syllabus-Count': String(docs.length) });
  const zip = archiver('zip', { zlib: { level: 6 } });
  zip.on('error', (err) => res.destroy(err));
  zip.pipe(res);
  for (const d of docs) {
    const pdf = await htmlToPdf(renderSyllabus(d), { footerText: footer(d) });
    zip.append(pdf, { name: `S${d.teachingUnit.semester}-${d.teachingUnit.code}.pdf` });
  }
  await zip.finalize();
  await prisma.syllabus.updateMany({ where: { teachingUnitId: { in: units.map((u) => u.id) }, academicYearId: year.id }, data: { generatedAt: new Date() } });
}
