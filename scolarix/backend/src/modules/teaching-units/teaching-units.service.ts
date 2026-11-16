import { Prisma, type TeachingUnit } from '@prisma/client';
import { z } from 'zod';
import {
  checkTeachingUnitRules,
  computeCost,
  computePaidHours,
  computeTotalHours,
  round2,
  type CreateTeachingUnitData,
  type ListTeachingUnitsQuery,
  type TeachingUnitDto,
  type TeachingUnitTotals,
  type UpdateTeachingUnitData,
} from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { assertNoDependents } from '../../common/utils/dependents';
import type { AuthUser } from '../../common/types';
import { assertCanManageSchool, assertSchoolAccess } from '../../common/middlewares/school-scope';

const include = { specialty: { select: { id: true, code: true, name: true } } } as const;
type UnitWithSpecialty = TeachingUnit & { specialty: { id: string; code: string; name: string } | null };

const num = (d: Prisma.Decimal) => d.toNumber();

/** Conversion BDD → API : les Decimal deviennent des nombres, le coût est calculé. */
export function toDto(u: UnitWithSpecialty): TeachingUnitDto {
  const paidHours = num(u.paidHours);
  const hourlyRate = u.hourlyRate ? num(u.hourlyRate) : null;
  return {
    id: u.id,
    levelId: u.levelId,
    specialtyId: u.specialtyId,
    specialty: u.specialty,
    code: u.code,
    title: u.title,
    description: u.description,
    semester: u.semester,
    credits: u.credits,
    coefficient: num(u.coefficient),
    cmHours: num(u.cmHours),
    tdHours: num(u.tdHours),
    tpHours: num(u.tpHours),
    totalHours: num(u.totalHours),
    paidHours,
    paidHoursAuto: u.paidHoursAuto,
    hourlyRate,
    estimatedCost: computeCost(paidHours, hourlyRate),
    ccWeight: u.ccWeight,
    examWeight: u.examWeight,
    tpWeight: u.tpWeight,
    objectives: u.objectives,
    prerequisites: u.prerequisites,
    bibliography: u.bibliography,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  };
}

/**
 * Cœur du calcul : à partir des heures CM/TD/TP, fixe totalHours et,
 * en mode automatique, paidHours. Le client ne peut jamais imposer totalHours.
 */
export function computeHours(h: { cmHours: number; tdHours: number; tpHours: number; paidHours?: number | null }) {
  const totalHours = computeTotalHours(h);
  const auto = h.paidHours === null || h.paidHours === undefined;
  return {
    totalHours,
    paidHoursAuto: auto,
    paidHours: auto ? computePaidHours(h) : round2(h.paidHours!),
  };
}

export function sumTotals(units: TeachingUnitDto[]): TeachingUnitTotals {
  const t = units.reduce(
    (acc, u) => ({
      count: acc.count + 1,
      credits: acc.credits + u.credits,
      cmHours: acc.cmHours + u.cmHours,
      tdHours: acc.tdHours + u.tdHours,
      tpHours: acc.tpHours + u.tpHours,
      totalHours: acc.totalHours + u.totalHours,
      paidHours: acc.paidHours + u.paidHours,
      estimatedCost: acc.estimatedCost + (u.estimatedCost ?? 0),
    }),
    { count: 0, credits: 0, cmHours: 0, tdHours: 0, tpHours: 0, totalHours: 0, paidHours: 0, estimatedCost: 0 },
  );
  // Nettoie les petites erreurs d'arrondi des additions successives
  for (const k of ['cmHours', 'tdHours', 'tpHours', 'totalHours', 'paidHours', 'estimatedCost'] as const) t[k] = round2(t[k]);
  return t;
}

// ---------------------------------------------------------------------------

async function getLevel(levelId: string) {
  const level = await prisma.level.findUnique({
    where: { id: levelId },
    select: { id: true, code: true, name: true, requiredCredits: true, schoolId: true },
  });
  if (!level) throw AppError.notFound('Niveau introuvable');
  return level;
}

async function findOrFail(id: string) {
  const unit = await prisma.teachingUnit.findUnique({ where: { id }, include: { ...include, level: { select: { schoolId: true } } } });
  if (!unit) throw AppError.notFound('UE introuvable');
  return unit;
}

/** Une UE de spécialité doit appartenir à une spécialité de la MÊME école que le niveau. */
async function assertSpecialtyInSchool(specialtyId: string | null | undefined, schoolId: string) {
  if (!specialtyId) return;
  const sp = await prisma.specialty.findUnique({ where: { id: specialtyId }, select: { schoolId: true } });
  if (!sp || sp.schoolId !== schoolId) {
    throw AppError.badRequest('Spécialité invalide', { specialtyId: ["Cette spécialité n'appartient pas à l'école du niveau"] });
  }
}

async function assertCodeFree(levelId: string, code: string, exceptId?: string) {
  const other = await prisma.teachingUnit.findUnique({ where: { levelId_code: { levelId, code } }, select: { id: true } });
  if (other && other.id !== exceptId) {
    throw new AppError(409, 'CONFLICT', 'Ce code est déjà utilisé', { code: ['Ce code existe déjà dans ce niveau'] });
  }
}

/** Revérifie les règles croisées (heures > 0, pondérations = 100) sur l'UE complète. */
function assertRules(d: Parameters<typeof checkTeachingUnitRules>[0]) {
  const result = z.object({}).passthrough().superRefine((v, ctx) => checkTeachingUnitRules(v as typeof d, ctx)).safeParse(d);
  if (!result.success) {
    const details: Record<string, string[]> = {};
    for (const i of result.error.issues) (details[i.path.join('.')] ??= []).push(i.message);
    throw AppError.badRequest('Données invalides', details);
  }
}

// ---------------------------------------------------------------------------

export async function list(user: AuthUser, levelId: string, q: ListTeachingUnitsQuery) {
  const level = await getLevel(levelId);
  assertSchoolAccess(user, level.schoolId);

  const where: Prisma.TeachingUnitWhereInput = {
    levelId,
    ...(q.semester && { semester: q.semester }),
    ...(q.isActive !== undefined && { isActive: q.isActive }),
    // Filtre spécialité : ses UE propres + le tronc commun
    ...(q.specialtyId === 'common' && { specialtyId: null }),
    ...(q.specialtyId && q.specialtyId !== 'common' && { OR: [{ specialtyId: q.specialtyId }, { specialtyId: null }] }),
    ...(q.search && {
      AND: [{ OR: [{ code: { contains: q.search, mode: 'insensitive' } }, { title: { contains: q.search, mode: 'insensitive' } }] }],
    }),
  };
  const units = (await prisma.teachingUnit.findMany({ where, include, orderBy: [{ semester: 'asc' }, { code: 'asc' }] })).map(toDto);
  return {
    data: units,
    totals: {
      semester1: sumTotals(units.filter((u) => u.semester === 1)),
      semester2: sumTotals(units.filter((u) => u.semester === 2)),
      year: sumTotals(units),
    },
    level,
  };
}

export async function getById(user: AuthUser, id: string) {
  const unit = await findOrFail(id);
  assertSchoolAccess(user, unit.level.schoolId);
  return toDto(unit);
}

export async function create(user: AuthUser, levelId: string, data: CreateTeachingUnitData) {
  const level = await getLevel(levelId);
  assertCanManageSchool(user, level.schoolId);
  await assertSpecialtyInSchool(data.specialtyId, level.schoolId);
  await assertCodeFree(levelId, data.code);

  const { paidHours, ...rest } = data;
  const unit = await prisma.teachingUnit.create({
    data: { ...rest, levelId, ...computeHours({ ...data, paidHours }) },
    include,
  });
  return toDto(unit);
}

export async function update(user: AuthUser, id: string, data: UpdateTeachingUnitData) {
  const current = await findOrFail(id);
  assertCanManageSchool(user, current.level.schoolId);
  if (data.specialtyId !== undefined) await assertSpecialtyInSchool(data.specialtyId, current.level.schoolId);
  if (data.code) await assertCodeFree(current.levelId, data.code, id);

  // Fusion avec les valeurs actuelles pour recalculer et revérifier l'ensemble
  const merged = {
    cmHours: data.cmHours ?? num(current.cmHours),
    tdHours: data.tdHours ?? num(current.tdHours),
    tpHours: data.tpHours ?? num(current.tpHours),
    ccWeight: data.ccWeight ?? current.ccWeight,
    examWeight: data.examWeight ?? current.examWeight,
    tpWeight: data.tpWeight ?? current.tpWeight,
  };
  assertRules(merged);

  // paidHours : absent = on garde le mode actuel ; null = repasser en automatique ; nombre = saisie manuelle
  const paidHours =
    data.paidHours !== undefined ? data.paidHours : current.paidHoursAuto ? null : num(current.paidHours);

  const { paidHours: _p, ...rest } = data;
  const unit = await prisma.teachingUnit.update({
    where: { id },
    data: { ...rest, ...computeHours({ ...merged, paidHours }) },
    include,
  });
  return toDto(unit);
}

export async function remove(user: AuthUser, id: string) {
  const current = await findOrFail(id);
  assertCanManageSchool(user, current.level.schoolId);
  const { _count } = await prisma.teachingUnit.findUniqueOrThrow({
    where: { id },
    select: { _count: { select: { grades: true, assignments: true, syllabi: true, sessions: true } } },
  });
  assertNoDependents(_count, {
    grades: 'note(s)',
    assignments: 'affectation(s) d’enseignant',
    syllabi: 'syllabus',
    sessions: 'séance(s) d’emploi du temps',
  });
  await prisma.teachingUnit.delete({ where: { id } });
}
