import { describe, expect, it } from 'vitest';
import {
  DAYS, generateSchedule, slotHours, splitSessions, weeklySessions,
  type Placed, type RoomDef, type SchedulerInput, type SessionReq, type SlotDef,
} from '../../src/modules/schedules/scheduler';

const SLOTS: SlotDef[] = [
  { id: 's1', order: 1, startTime: '08:00', endTime: '10:00' },
  { id: 's2', order: 2, startTime: '10:00', endTime: '12:00' },
  { id: 's3', order: 3, startTime: '14:00', endTime: '16:00' },
  { id: 's4', order: 4, startTime: '16:00', endTime: '18:00' },
];
const room = (id: string, capacity: number, types: RoomDef['types'], unavailable: string[] = []): RoomDef => ({ id, code: id, capacity, types, unavailable: new Set(unavailable) });
let n = 0;
const sess = (p: Partial<SessionReq>): SessionReq => ({ key: `k${n++}`, teachingUnitId: 'ue', ueCode: 'UE', type: 'CM', teacherId: null, audience: null, size: 30, ...p });
const base = (p: Partial<SchedulerInput>): SchedulerInput => ({
  slots: SLOTS, rooms: [room('A', 100, ['CM', 'TD']), room('LAB', 30, ['TP'])], sessions: [],
  teacherUnavailable: new Map(), busyTeachers: new Set(), busyRooms: new Set(), ...p,
});

/** Vérifie TOUTES les contraintes dures sur un résultat. */
function assertValid(input: SchedulerInput, placed: Placed[]) {
  const seen = new Set<string>();
  for (const p of placed) {
    const cell = `${p.day}|${p.timeslotId}`;
    const slot = SLOTS.find((s) => s.id === p.timeslotId)!;
    if (p.teacherId) {
      const k = `${p.teacherId}|${cell}`;
      expect(seen.has('T' + k), `enseignant en double ${k}`).toBe(false);
      expect(input.busyTeachers.has(k), `enseignant déjà pris ailleurs ${k}`).toBe(false);
      expect(input.teacherUnavailable.get(p.teacherId)?.has(`${p.day}@${slot.startTime}`) ?? false).toBe(false);
      seen.add('T' + k);
    }
    if (p.roomId) {
      const k = `${p.roomId}|${cell}`;
      expect(seen.has('R' + k), `salle en double ${k}`).toBe(false);
      expect(input.busyRooms.has(k)).toBe(false);
      const r = input.rooms.find((x) => x.id === p.roomId)!;
      expect(r.types).toContain(p.type);
      expect(r.capacity).toBeGreaterThanOrEqual(p.size);
      expect(r.unavailable.has(`${p.day}@${slot.startTime}`)).toBe(false);
      seen.add('R' + k);
    }
  }
  for (const a of placed) for (const b of placed) {
    if (a === b || a.day !== b.day || a.timeslotId !== b.timeslotId) continue;
    expect(a.audience !== null && b.audience !== null && a.audience !== b.audience, `conflit de public ${a.key}/${b.key}`).toBe(true);
  }
}

describe('volumes → séances hebdomadaires', () => {
  it('⌈volume / (semaines × durée)⌉, au moins 1', () => {
    expect(weeklySessions(30, 14, 2)).toBe(2); // 30 / 28
    expect(weeklySessions(28, 14, 2)).toBe(1);
    expect(weeklySessions(12, 14, 2)).toBe(1);
    expect(weeklySessions(0, 14, 2)).toBe(0);
    expect(slotHours({ startTime: '08:00', endTime: '10:00' })).toBe(2);
  });
  it('répartit les séances entre enseignants au prorata des heures', () => {
    expect(splitSessions(3, [{ teacherId: 'a', hours: 20 }, { teacherId: 'b', hours: 10 }]).sort()).toEqual(['a', 'a', 'b']);
    expect(splitSessions(2, [])).toEqual([null, null]);
  });
});

describe('contraintes', () => {
  it('tronc commun : bloque tout le niveau ; spécialités différentes : en parallèle', () => {
    const input = base({
      days: ['LUNDI'], slots: SLOTS.slice(0, 2),
      rooms: [room('A', 100, ['CM']), room('B', 100, ['CM'])],
      sessions: [sess({ audience: null, teacherId: 't1' }), sess({ audience: 'GL', teacherId: 't2' }), sess({ audience: 'RT', teacherId: 't3' })],
    });
    const r = generateSchedule(input);
    expect(r.unplaced).toEqual([]);
    assertValid(input, r.placed);
    const common = r.placed.find((p) => p.audience === null)!;
    const gl = r.placed.find((p) => p.audience === 'GL')!;
    const rt = r.placed.find((p) => p.audience === 'RT')!;
    expect(gl.timeslotId).toBe(rt.timeslotId); // GL et RT ensemble
    expect(common.timeslotId).not.toBe(gl.timeslotId);
  });

  it('respecte les indisponibilités de l’enseignant et les cours d’autres niveaux', () => {
    const input = base({
      days: ['LUNDI'],
      sessions: [sess({ teacherId: 't1' })],
      teacherUnavailable: new Map([['t1', new Set(['LUNDI@08:00', 'LUNDI@10:00'])]]),
      busyTeachers: new Set(['t1|LUNDI|s3']),
    });
    const r = generateSchedule(input);
    expect(r.placed[0]!.timeslotId).toBe('s4');
  });

  it('salle : type et capacité ; la plus petite salle suffisante', () => {
    const input = base({
      days: ['LUNDI'], slots: SLOTS.slice(0, 1),
      rooms: [room('BIG', 200, ['CM']), room('SMALL', 40, ['CM']), room('LAB', 40, ['TP'])],
      sessions: [sess({ type: 'CM', size: 35 })],
    });
    expect(generateSchedule(input).placed[0]!.roomId).toBe('SMALL');
  });

  it('séance impossible → non placée avec la raison', () => {
    const r1 = generateSchedule(base({ sessions: [sess({ type: 'TP', size: 60 })] }));
    expect(r1.unplaced[0]!.reason).toContain('aucune salle ne convient');
    const r2 = generateSchedule(base({
      days: ['LUNDI'], slots: SLOTS.slice(0, 1),
      sessions: [sess({ teacherId: 't1' })], teacherUnavailable: new Map([['t1', new Set(['LUNDI@08:00'])]]),
    }));
    expect(r2.unplaced[0]!.reason).toContain("l'enseignant");
  });

  it('séances épinglées conservées, les autres s’organisent autour', () => {
    const locked: Placed = { ...sess({ teacherId: 't1' }), day: 'LUNDI', timeslotId: 's1', roomId: 'A' };
    const input = base({ days: ['LUNDI'], sessions: [sess({ teacherId: 't1' })], locked: [locked] });
    const r = generateSchedule(input);
    expect(r.placed).toContainEqual(locked);
    expect(r.placed.find((p) => p.key !== locked.key)!.timeslotId).not.toBe('s1');
  });

  it('préférence : pas deux séances de la même UE le même jour', () => {
    const r = generateSchedule(base({ days: ['LUNDI', 'MARDI'], sessions: [sess({ teachingUnitId: 'X' }), sess({ teachingUnitId: 'X' })] }));
    expect(new Set(r.placed.map((p) => p.day)).size).toBe(2);
  });

  it('cas sans solution complète : repli glouton, maximum placé', () => {
    // 1 case par public : tronc commun + 2 TP en parallèle mais une seule salle de TP
    const input = base({
      days: ['LUNDI'], slots: SLOTS.slice(0, 2), rooms: [room('A', 100, ['CM']), room('LAB', 40, ['TP'])],
      sessions: [sess({ type: 'CM' }), sess({ type: 'TP', audience: 'GL', size: 20 }), sess({ type: 'TP', audience: 'RT', size: 20 })],
    });
    const r = generateSchedule(input);
    expect(r.strategy).toBe('glouton');
    expect(r.placed).toHaveLength(2);
    expect(r.unplaced).toHaveLength(1);
    assertValid(input, r.placed);
  });
});

describe('propriété : 200 instances aléatoires, aucune contrainte dure violée', () => {
  // Générateur pseudo-aléatoire déterministe (résultats reproductibles)
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;

  it('valide', () => {
    for (let t = 0; t < 200; t++) {
      const teachers = ['t1', 't2', 't3', 't4'];
      const rooms = [room('A', 120, ['CM', 'TD']), room('B', 40, ['TD']), room('L', 25, ['TP'], rnd() < 0.5 ? ['LUNDI@08:00'] : [])];
      const sessions = Array.from({ length: 5 + Math.floor(rnd() * 25) }, () =>
        sess({ teachingUnitId: pick(['u1', 'u2', 'u3', 'u4', 'u5']), type: pick(['CM', 'TD', 'TP'] as const), teacherId: rnd() < 0.9 ? pick(teachers) : null, audience: pick([null, 'GL', 'RT']), size: 10 + Math.floor(rnd() * 40) }),
      );
      const unav = new Map(teachers.map((id) => [id, new Set(Array.from({ length: Math.floor(rnd() * 8) }, () => `${pick(DAYS)}@${pick(SLOTS).startTime}`))]));
      const busy = new Set(Array.from({ length: 5 }, () => `${pick(teachers)}|${pick(DAYS)}|${pick(SLOTS).id}`));
      const input = base({ rooms, sessions, teacherUnavailable: unav, busyTeachers: busy, maxSteps: 5000 });
      const r = generateSchedule(input);
      expect(r.placed.length + r.unplaced.length).toBe(sessions.length);
      assertValid(input, r.placed);
    }
  });
});
