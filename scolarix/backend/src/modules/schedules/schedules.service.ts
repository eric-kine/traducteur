import type { Prisma, Weekday } from '@prisma/client';
import type { z } from 'zod';
import type {
  addSessionSchema, generateScheduleSchema, moveSessionSchema, ScheduleDto, ScheduleReport, SessionView, TimeslotDto,
  TimetableView, Unavailability,
} from '@scolarix/shared';
import { WEEKDAYS } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import type { AuthUser } from '../../common/types';
import { assertCanManageSchool, assertSchoolAccess } from '../../common/middlewares/school-scope';
import * as institute from '../institute/institute.service';
import { generateSchedule, slotHours, splitSessions, weeklySessions, type Placed, type SessionReq } from './scheduler';

const DEFAULT_SLOTS = [['08:00', '10:00'], ['10:00', '12:00'], ['14:00', '16:00'], ['16:00', '18:00']] as const;

// ═══════════════════════════ Créneaux ═══════════════════════════

/** Grille horaire ; créée avec les valeurs par défaut (08-12, 14-18) au premier usage. */
export async function getTimeslots(): Promise<TimeslotDto[]> {
  const instituteId = await institute.getId();
  let slots = await prisma.timeslot.findMany({ where: { instituteId }, orderBy: { order: 'asc' } });
  if (!slots.length) {
    await prisma.timeslot.createMany({ data: DEFAULT_SLOTS.map(([s, e], i) => ({ instituteId, order: i + 1, startTime: s, endTime: e })), skipDuplicates: true });
    slots = await prisma.timeslot.findMany({ where: { instituteId }, orderBy: { order: 'asc' } });
  }
  return slots.map(({ id, order, startTime, endTime }) => ({ id, order, startTime, endTime }));
}

/** Remplace la grille (refusé si des séances utilisent un créneau supprimé). */
export async function setTimeslots(slots: { startTime: string; endTime: string }[]) {
  const instituteId = await institute.getId();
  const current = await getTimeslots();
  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const keep = new Set(sorted.map((s) => s.startTime));
  const removed = current.filter((c) => !keep.has(c.startTime));
  if (removed.length) {
    const used = await prisma.scheduleSession.count({ where: { timeslotId: { in: removed.map((r) => r.id) } } });
    if (used) throw new AppError(409, 'IN_USE', `${used} séance(s) utilisent un créneau supprimé : supprimez ou régénérez d'abord les emplois du temps concernés`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.timeslot.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
    // ordre temporaire pour éviter les conflits d'unicité pendant la mise à jour
    for (const c of current.filter((c) => keep.has(c.startTime))) await tx.timeslot.update({ where: { id: c.id }, data: { order: 1000 + c.order } });
    for (const [i, s] of sorted.entries()) {
      const existing = current.find((c) => c.startTime === s.startTime);
      if (existing) await tx.timeslot.update({ where: { id: existing.id }, data: { order: i + 1, endTime: s.endTime } });
      else await tx.timeslot.create({ data: { instituteId, order: i + 1, startTime: s.startTime, endTime: s.endTime } });
    }
  });
  return getTimeslots();
}

// ═══════════════════════════ Conversions ═══════════════════════════

const sessionInclude = {
  teachingUnit: { select: { id: true, code: true, title: true } },
  teacher: { select: { id: true, title: true, firstName: true, lastName: true } },
  room: { select: { id: true, code: true, capacity: true } },
  audienceSpecialty: { select: { id: true, code: true } },
  schedule: { select: { level: { select: { id: true, code: true, name: true, school: { select: { code: true } } } } } },
} as const;
type SessionRow = Prisma.ScheduleSessionGetPayload<{ include: typeof sessionInclude }>;

const toView = (s: SessionRow): SessionView => ({
  id: s.id,
  scheduleId: s.scheduleId,
  day: s.day,
  timeslotId: s.timeslotId,
  sessionType: s.sessionType,
  locked: s.locked,
  teachingUnit: s.teachingUnit,
  teacher: s.teacher ? { id: s.teacher.id, name: `${s.teacher.title ? s.teacher.title + ' ' : ''}${s.teacher.firstName[0]}. ${s.teacher.lastName}` } : null,
  room: s.room,
  audience: s.audienceSpecialty,
  level: { id: s.schedule.level.id, code: s.schedule.level.code, name: s.schedule.level.name },
  school: s.schedule.level.school,
});

const unavailabilitySet = (json: unknown) => new Set(((json as Unavailability | null) ?? []).map((u) => `${u.day}@${u.start}`));

async function scheduleDto(user: AuthUser, id: string): Promise<ScheduleDto> {
  const s = await prisma.schedule.findUnique({ where: { id }, include: { academicYear: true, level: true } });
  if (!s) throw AppError.notFound('Emploi du temps introuvable');
  assertSchoolAccess(user, s.level.schoolId);
  let canEdit = true;
  try { assertCanManageSchool(user, s.level.schoolId); } catch { canEdit = false; }
  return {
    id: s.id, semester: s.semester, weeks: s.weeks, status: s.status, generatedAt: s.generatedAt?.toISOString() ?? null,
    report: s.generationReport as ScheduleReport | null,
    academicYear: { id: s.academicYear.id, label: s.academicYear.label },
    level: { id: s.level.id, code: s.level.code, name: s.level.name, schoolId: s.level.schoolId },
    canEdit,
  };
}

// ═══════════════════════════ Génération ═══════════════════════════

export async function generate(user: AuthUser, input: z.output<typeof generateScheduleSchema>) {
  const level = await prisma.level.findUnique({ where: { id: input.levelId }, include: { school: true } });
  if (!level) throw AppError.notFound('Niveau introuvable');
  assertCanManageSchool(user, level.schoolId);
  const year = await prisma.academicYear.findUnique({ where: { id: input.academicYearId } });
  if (!year) throw AppError.notFound('Année académique introuvable');

  const slots = await getTimeslots();
  const slotDuration = slotHours(slots[0]!);
  const [units, rooms, enrollments, existing] = await Promise.all([
    prisma.teachingUnit.findMany({
      where: { levelId: level.id, semester: input.semester, isActive: true },
      include: { specialty: { select: { code: true } }, assignments: { where: { academicYearId: year.id }, include: { teacher: true } } },
      orderBy: { code: 'asc' },
    }),
    prisma.room.findMany({ where: { isActive: true } }),
    prisma.enrollment.groupBy({ by: ['specialtyId'], where: { levelId: level.id, academicYearId: year.id, status: { notIn: ['ANNULE', 'EN_ATTENTE'] } }, _count: true }),
    prisma.schedule.findUnique({
      where: { academicYearId_levelId_semester: { academicYearId: year.id, levelId: level.id, semester: input.semester } },
      include: { sessions: true },
    }),
  ]);
  if (!units.length) throw AppError.badRequest(`Aucune UE active au semestre ${input.semester} pour ce niveau`);

  // Effectifs : tronc commun = tout le niveau ; spécialité = ses inscrits
  const total = enrollments.reduce((a, e) => a + e._count, 0);
  const sizeOf = (aud: string | null) => Math.max(1, aud ? (enrollments.find((e) => e.specialtyId === aud)?._count ?? 0) : total);
  const warnings: string[] = [];
  if (!total) warnings.push("Aucun étudiant inscrit pour cette année : la capacité des salles n'a pas pu être vérifiée.");

  // Séances à placer
  const requests: SessionReq[] = [];
  const coverage: ScheduleReport['coverage'] = [];
  for (const u of units) {
    for (const type of ['CM', 'TD', 'TP'] as const) {
      const hours = u[({ CM: 'cmHours', TD: 'tdHours', TP: 'tpHours' } as const)[type]].toNumber();
      const n = weeklySessions(hours, input.weeks, slotDuration);
      if (!n) continue;
      const teachers = u.assignments.filter((a) => a.sessionType === type).map((a) => ({ teacherId: a.teacherId, hours: a.assignedHours.toNumber() }));
      if (!teachers.length) warnings.push(`${u.code} ${type} : aucun enseignant affecté, séance(s) placée(s) sans enseignant.`);
      coverage.push({ teachingUnit: u.code, sessionType: type, quotaHours: hours, weeklySessions: n, plannedHours: n * slotDuration * input.weeks });
      splitSessions(n, teachers).forEach((teacherId, k) =>
        requests.push({ key: `${u.id}|${type}|${k}`, teachingUnitId: u.id, ueCode: u.code, type, teacherId, audience: u.specialtyId, size: sizeOf(u.specialtyId) }),
      );
    }
  }

  // Séances épinglées : conservées, et retirées des besoins
  const locked: Placed[] = [];
  for (const l of existing?.sessions.filter((s) => s.locked) ?? []) {
    const idx = requests.findIndex((r) => r.teachingUnitId === l.teachingUnitId && r.type === l.sessionType && (r.teacherId === l.teacherId || !r.teacherId));
    const base = idx >= 0 ? requests.splice(idx, 1)[0]! : null;
    locked.push({
      key: `locked|${l.id}`, teachingUnitId: l.teachingUnitId, ueCode: base?.ueCode ?? '', type: l.sessionType, teacherId: l.teacherId,
      audience: l.audienceSpecialtyId, size: base?.size ?? 1, day: l.day, timeslotId: l.timeslotId, roomId: l.roomId,
    });
  }

  // Occupations venant des autres niveaux (même année, même semestre)
  const others = await prisma.scheduleSession.findMany({
    where: { academicYearId: year.id, semester: input.semester, ...(existing && { scheduleId: { not: existing.id } }) },
    select: { teacherId: true, roomId: true, day: true, timeslotId: true },
  });
  const teacherIds = [...new Set(requests.map((r) => r.teacherId).filter(Boolean) as string[])];
  const teacherRows = await prisma.teacher.findMany({ where: { id: { in: teacherIds } }, select: { id: true, unavailability: true, firstName: true, lastName: true } });

  const result = generateSchedule({
    slots,
    rooms: rooms.map((r) => ({ id: r.id, code: r.code, capacity: r.capacity, types: r.supportedTypes, unavailable: unavailabilitySet(r.unavailability) })),
    sessions: requests,
    teacherUnavailable: new Map(teacherRows.map((t) => [t.id, unavailabilitySet(t.unavailability)])),
    busyTeachers: new Set(others.filter((o) => o.teacherId).map((o) => `${o.teacherId}|${o.day}|${o.timeslotId}`)),
    busyRooms: new Set(others.filter((o) => o.roomId).map((o) => `${o.roomId}|${o.day}|${o.timeslotId}`)),
    locked,
  });

  const teacherName = (id: string | null) => { const t = teacherRows.find((x) => x.id === id); return t ? `${t.firstName} ${t.lastName}` : null; };
  const specialtyCode = (id: string | null) => (id ? units.find((u) => u.specialtyId === id)?.specialty?.code ?? null : null);
  const report: ScheduleReport = {
    strategy: result.strategy,
    steps: result.steps,
    total: requests.length + locked.length,
    placed: result.placed.length,
    unplaced: result.unplaced.map(({ session: s, reason }) => ({ teachingUnit: s.ueCode, sessionType: s.type, teacher: teacherName(s.teacherId), audience: specialtyCode(s.audience), reason })),
    warnings: [...warnings, ...result.warnings],
    coverage,
  };

  const scheduleId = await prisma.$transaction(async (tx) => {
    const sched = await tx.schedule.upsert({
      where: { academicYearId_levelId_semester: { academicYearId: year.id, levelId: level.id, semester: input.semester } },
      create: { academicYearId: year.id, levelId: level.id, semester: input.semester, weeks: input.weeks, generationReport: report as unknown as Prisma.InputJsonValue, generatedAt: new Date() },
      update: { weeks: input.weeks, generationReport: report as unknown as Prisma.InputJsonValue, generatedAt: new Date(), status: 'BROUILLON' },
    });
    await tx.scheduleSession.deleteMany({ where: { scheduleId: sched.id, locked: false } });
    await tx.scheduleSession.createMany({
      data: result.placed.filter((p) => !p.key.startsWith('locked|')).map((p) => ({
        scheduleId: sched.id, academicYearId: year.id, semester: input.semester, day: p.day as Weekday, timeslotId: p.timeslotId,
        sessionType: p.type, teachingUnitId: p.teachingUnitId, audienceSpecialtyId: p.audience, teacherId: p.teacherId, roomId: p.roomId,
      })),
    });
    return sched.id;
  });
  return levelView(user, scheduleId);
}

// ═══════════════════════════ Vues (grilles) ═══════════════════════════

export async function levelView(user: AuthUser, scheduleId: string): Promise<TimetableView> {
  const schedule = await scheduleDto(user, scheduleId);
  const sessions = await prisma.scheduleSession.findMany({ where: { scheduleId }, include: sessionInclude });
  return {
    kind: 'level',
    title: `${schedule.level.name} (${schedule.level.code})`,
    subtitle: `Semestre ${schedule.semester} · ${schedule.academicYear.label}`,
    days: [...WEEKDAYS], slots: await getTimeslots(), sessions: sessions.map(toView), schedule,
  };
}

export async function findSchedule(user: AuthUser, levelId: string, academicYearId: string, semester: number) {
  const level = await prisma.level.findUnique({ where: { id: levelId } });
  if (!level) throw AppError.notFound('Niveau introuvable');
  assertSchoolAccess(user, level.schoolId);
  const s = await prisma.schedule.findUnique({ where: { academicYearId_levelId_semester: { academicYearId, levelId, semester } } });
  return s ? levelView(user, s.id) : null;
}

export async function teacherView(teacherId: string, academicYearId: string, semester: number): Promise<TimetableView> {
  const [t, y] = await Promise.all([prisma.teacher.findUnique({ where: { id: teacherId } }), prisma.academicYear.findUnique({ where: { id: academicYearId } })]);
  if (!t || !y) throw AppError.notFound('Enseignant ou année introuvable');
  const sessions = await prisma.scheduleSession.findMany({ where: { teacherId, academicYearId, semester }, include: sessionInclude });
  return {
    kind: 'teacher', title: `${t.title ? t.title + ' ' : ''}${t.firstName} ${t.lastName.toUpperCase()}`,
    subtitle: `Semestre ${semester} · ${y.label}`, days: [...WEEKDAYS], slots: await getTimeslots(), sessions: sessions.map(toView),
  };
}

export async function roomView(roomId: string, academicYearId: string, semester: number): Promise<TimetableView> {
  const [r, y] = await Promise.all([prisma.room.findUnique({ where: { id: roomId } }), prisma.academicYear.findUnique({ where: { id: academicYearId } })]);
  if (!r || !y) throw AppError.notFound('Salle ou année introuvable');
  const sessions = await prisma.scheduleSession.findMany({ where: { roomId, academicYearId, semester }, include: sessionInclude });
  return {
    kind: 'room', title: `Salle ${r.code}${r.name ? ` — ${r.name}` : ''}`, subtitle: `${r.capacity} places · Semestre ${semester} · ${y.label}`,
    days: [...WEEKDAYS], slots: await getTimeslots(), sessions: sessions.map(toView),
  };
}

// ═══════════════════════════ Modifications manuelles ═══════════════════════════

/** Vérifie les contraintes dures pour une séance à une case donnée ; lève 409 avec la raison. */
async function assertPlacementOk(p: {
  id?: string; scheduleId: string; academicYearId: string; semester: number; day: Weekday; timeslotId: string;
  teacherId: string | null; roomId: string | null; audienceSpecialtyId: string | null; sessionType: string;
}) {
  const slot = await prisma.timeslot.findUnique({ where: { id: p.timeslotId } });
  if (!slot) throw AppError.badRequest('Créneau introuvable');
  const same = { academicYearId: p.academicYearId, semester: p.semester, day: p.day, timeslotId: p.timeslotId, ...(p.id && { id: { not: p.id } }) };
  const conflict = (msg: string) => new AppError(409, 'CONFLICT', msg);

  const inLevel = await prisma.scheduleSession.findMany({ where: { ...same, scheduleId: p.scheduleId }, include: { teachingUnit: true, audienceSpecialty: true } });
  const clash = inLevel.find((o) => o.audienceSpecialtyId === null || p.audienceSpecialtyId === null || o.audienceSpecialtyId === p.audienceSpecialtyId);
  if (clash) throw conflict(`Le niveau a déjà ${clash.teachingUnit.code} (${clash.sessionType}${clash.audienceSpecialty ? ' · ' + clash.audienceSpecialty.code : ', tronc commun'}) sur ce créneau`);

  if (p.teacherId) {
    const t = await prisma.teacher.findUniqueOrThrow({ where: { id: p.teacherId } });
    if (unavailabilitySet(t.unavailability).has(`${p.day}@${slot.startTime}`)) throw conflict(`${t.firstName} ${t.lastName} est indisponible sur ce créneau`);
    const busy = await prisma.scheduleSession.findFirst({ where: { ...same, teacherId: p.teacherId }, include: { teachingUnit: true, schedule: { include: { level: true } } } });
    if (busy) throw conflict(`${t.firstName} ${t.lastName} enseigne déjà ${busy.teachingUnit.code} (${busy.schedule.level.code}) sur ce créneau`);
  }
  if (p.roomId) {
    const r = await prisma.room.findUniqueOrThrow({ where: { id: p.roomId } });
    if (!r.supportedTypes.includes(p.sessionType as never)) throw conflict(`La salle ${r.code} n'accueille pas de ${p.sessionType}`);
    if (unavailabilitySet(r.unavailability).has(`${p.day}@${slot.startTime}`)) throw conflict(`La salle ${r.code} est indisponible sur ce créneau`);
    const busy = await prisma.scheduleSession.findFirst({ where: { ...same, roomId: p.roomId }, include: { teachingUnit: true, schedule: { include: { level: true } } } });
    if (busy) throw conflict(`La salle ${r.code} est déjà prise par ${busy.teachingUnit.code} (${busy.schedule.level.code})`);
  }
}

async function sessionOrFail(user: AuthUser, id: string) {
  const s = await prisma.scheduleSession.findUnique({ where: { id }, include: { schedule: { include: { level: true } } } });
  if (!s) throw AppError.notFound('Séance introuvable');
  assertCanManageSchool(user, s.schedule.level.schoolId);
  return s;
}

/** Déplacer / changer de salle ou d'enseignant / épingler. Une séance déplacée est épinglée. */
export async function moveSession(user: AuthUser, id: string, data: MoveSessionInput) {
  const s = await sessionOrFail(user, id);
  const next = {
    day: (data.day ?? s.day) as Weekday,
    timeslotId: data.timeslotId ?? s.timeslotId,
    teacherId: data.teacherId !== undefined ? data.teacherId : s.teacherId,
    roomId: data.roomId !== undefined ? data.roomId : s.roomId,
  };
  const moved = next.day !== s.day || next.timeslotId !== s.timeslotId || next.teacherId !== s.teacherId || next.roomId !== s.roomId;
  if (moved) await assertPlacementOk({ ...s, ...next });
  await prisma.scheduleSession.update({ where: { id }, data: { ...next, locked: data.locked ?? (moved ? true : s.locked) } });
  return levelView(user, s.scheduleId);
}
type MoveSessionInput = z.output<typeof moveSessionSchema>;

export async function addSession(user: AuthUser, scheduleId: string, data: z.output<typeof addSessionSchema>) {
  const sched = await prisma.schedule.findUnique({ where: { id: scheduleId }, include: { level: true } });
  if (!sched) throw AppError.notFound('Emploi du temps introuvable');
  assertCanManageSchool(user, sched.level.schoolId);
  const ue = await prisma.teachingUnit.findUnique({ where: { id: data.teachingUnitId } });
  if (!ue || ue.levelId !== sched.levelId) throw AppError.badRequest("Cette UE n'appartient pas au niveau");
  const p = {
    scheduleId, academicYearId: sched.academicYearId, semester: sched.semester, day: data.day as Weekday, timeslotId: data.timeslotId,
    teacherId: data.teacherId ?? null, roomId: data.roomId ?? null, audienceSpecialtyId: ue.specialtyId, sessionType: data.sessionType,
  };
  await assertPlacementOk(p);
  await prisma.scheduleSession.create({ data: { ...p, teachingUnitId: ue.id, locked: true } });
  return levelView(user, scheduleId);
}

export async function deleteSession(user: AuthUser, id: string) {
  const s = await sessionOrFail(user, id);
  await prisma.scheduleSession.delete({ where: { id } });
  return levelView(user, s.scheduleId);
}

export async function setStatus(user: AuthUser, id: string, status: 'BROUILLON' | 'PUBLIE') {
  const dto = await scheduleDto(user, id);
  assertCanManageSchool(user, dto.level.schoolId);
  await prisma.schedule.update({ where: { id }, data: { status } });
  return levelView(user, id);
}

export async function removeSchedule(user: AuthUser, id: string) {
  const dto = await scheduleDto(user, id);
  assertCanManageSchool(user, dto.level.schoolId);
  await prisma.schedule.delete({ where: { id } }); // séances supprimées en cascade
}
