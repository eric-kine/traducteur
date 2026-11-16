/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  GÉNÉRATEUR D'EMPLOI DU TEMPS — glouton ordonné + retour arrière (backtracking)
 * ═══════════════════════════════════════════════════════════════════════════
 * Fonction PURE (aucun accès base) : testée seule dans tests/unit/scheduler.test.ts.
 *
 * Entrées : jours (LUNDI→SAMEDI), créneaux (08-10, 10-12, 14-16, 16-18), salles,
 *           séances à placer (UE × type × enseignant × public), indisponibilités,
 *           occupations venant des AUTRES emplois du temps (enseignants et salles
 *           partagés), séances épinglées.
 *
 * Contraintes DURES (jamais violées) :
 *   C1 un enseignant n'a qu'une séance par case (jour × créneau), tous niveaux confondus
 *   C2 une salle n'accueille qu'une séance par case, tous niveaux confondus
 *   C3 le niveau : deux séances d'une même case ne visent pas le même public ; une
 *      séance de tronc commun (public = null) occupe tout le niveau
 *   C4 l'enseignant est disponible sur la case ; C5 la salle aussi
 *   C6 la salle accepte le type (CM/TD/TP) et a assez de places pour le public
 *
 * Préférences (score, plus petit = meilleur) :
 *   P1 pas deux séances de la même UE le même jour      (+10 par séance déjà ce jour)
 *   P2 équilibrer la charge des jours pour le public     (+2 par séance déjà ce jour)
 *   P3 plutôt le matin, plutôt en début de semaine      (+0,1 × rang du créneau, +0,01 × rang du jour)
 *   P4 la plus petite salle suffisante (garder les grandes salles libres)
 *
 * PSEUDO-CODE
 *   placer d'abord les séances épinglées (verrouillées)
 *   trier les séances : domaine (nb de cases possibles) croissant, puis CM avant TD/TP,
 *                       puis public le plus nombreux          ← "le plus contraint d'abord"
 *   fonction PLACER(i):
 *       si i = nombre de séances : SUCCÈS
 *       pour chaque case (jour, créneau) triée par score croissant :
 *           si C1..C6 respectées et une salle convient :
 *               réserver (enseignant, salle, public) ; si PLACER(i+1) : SUCCÈS
 *               libérer (retour arrière)
 *           si étapes > budget : ABANDON
 *       ÉCHEC
 *   si PLACER(0) réussit : emploi du temps complet
 *   sinon (impossible ou budget dépassé) : GLOUTON — chaque séance, dans l'ordre, prend
 *       sa meilleure case libre ; celles qui n'en ont aucune sont listées avec la raison
 */

export const DAYS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'] as const;
export type Day = (typeof DAYS)[number];
export type SessionType = 'CM' | 'TD' | 'TP';

export interface SlotDef { id: string; order: number; startTime: string; endTime: string }
export interface RoomDef { id: string; code: string; capacity: number; types: SessionType[]; unavailable: Set<string> }
export interface SessionReq {
  key: string;
  teachingUnitId: string;
  ueCode: string;
  type: SessionType;
  teacherId: string | null;
  audience: string | null; // null = tronc commun (tout le niveau), sinon id de spécialité
  size: number; // nombre d'étudiants concernés
}
export interface Placed extends SessionReq { day: Day; timeslotId: string; roomId: string | null }
export interface Unplaced { session: SessionReq; reason: string }

export interface SchedulerInput {
  days?: readonly Day[];
  slots: SlotDef[];
  rooms: RoomDef[];
  sessions: SessionReq[];
  /** clé `${day}@${startTime}` des cases où l'enseignant est indisponible */
  teacherUnavailable: Map<string, Set<string>>;
  /** occupations venant des autres emplois du temps : `${id}|${day}|${timeslotId}` */
  busyTeachers: Set<string>;
  busyRooms: Set<string>;
  /** séances épinglées, déjà placées (gardées telles quelles) */
  locked?: Placed[];
  maxSteps?: number;
}

export interface SchedulerResult {
  placed: Placed[];
  unplaced: Unplaced[];
  warnings: string[];
  strategy: 'backtracking' | 'glouton';
  steps: number;
}

const cellKey = (day: string, slotId: string) => `${day}|${slotId}`;

export function generateSchedule(input: SchedulerInput): SchedulerResult {
  const days = input.days ?? DAYS;
  const slots = [...input.slots].sort((a, b) => a.order - b.order);
  const maxSteps = input.maxSteps ?? 50_000;
  const warnings: string[] = [];

  // ---- État des réservations (modifié pendant la recherche, puis restauré) ----
  const teacherBusy = new Set(input.busyTeachers);
  const roomBusy = new Set(input.busyRooms);
  const audienceAt = new Map<string, string[]>(); // case → publics présents ('*' = tronc commun)
  const ueDay = new Map<string, number>(); // `${ue}|${day}` → nb de séances
  const audDay = new Map<string, number>(); // `${public}|${day}` → nb de séances
  const AUD = (a: string | null) => a ?? '*';

  const audienceFree = (day: string, slotId: string, aud: string | null) => {
    const present = audienceAt.get(cellKey(day, slotId)) ?? [];
    if (!present.length) return true;
    if (aud === null) return false; // le tronc commun a besoin de tout le niveau
    return !present.includes('*') && !present.includes(aud);
  };

  // Salles compatibles (type + capacité) : si AUCUNE ne convient, on place sans salle (avertissement)
  const staticRooms = new Map<string, RoomDef[]>();
  for (const s of input.sessions) {
    const ok = input.rooms.filter((r) => r.types.includes(s.type) && r.capacity >= s.size).sort((a, b) => a.capacity - b.capacity);
    staticRooms.set(s.key, ok);
    if (!ok.length && input.rooms.length) {
      // pas de salle compatible : la séance sera non placée (C6), raison donnée plus bas
    }
  }
  if (!input.rooms.length) warnings.push('Aucune salle enregistrée : les séances sont placées sans salle.');

  const teacherOk = (s: SessionReq, day: string, slot: SlotDef) =>
    !s.teacherId ||
    (!teacherBusy.has(`${s.teacherId}|${day}|${slot.id}`) && !input.teacherUnavailable.get(s.teacherId)?.has(`${day}@${slot.startTime}`));

  const pickRoom = (s: SessionReq, day: string, slot: SlotDef): string | null | undefined => {
    if (!input.rooms.length) return null; // aucune salle gérée
    for (const r of staticRooms.get(s.key)!) {
      if (!roomBusy.has(`${r.id}|${day}|${slot.id}`) && !r.unavailable.has(`${day}@${slot.startTime}`)) return r.id;
    }
    return undefined; // aucune salle libre
  };

  const reserve = (p: Placed, delta: 1 | -1) => {
    const ck = cellKey(p.day, p.timeslotId);
    const t = p.teacherId && `${p.teacherId}|${p.day}|${p.timeslotId}`;
    const r = p.roomId && `${p.roomId}|${p.day}|${p.timeslotId}`;
    const list = audienceAt.get(ck) ?? [];
    if (delta === 1) {
      if (t) teacherBusy.add(t);
      if (r) roomBusy.add(r);
      list.push(AUD(p.audience));
    } else {
      if (t) teacherBusy.delete(t);
      if (r) roomBusy.delete(r);
      list.splice(list.indexOf(AUD(p.audience)), 1);
    }
    audienceAt.set(ck, list);
    const u = `${p.teachingUnitId}|${p.day}`;
    const a = `${AUD(p.audience)}|${p.day}`;
    ueDay.set(u, (ueDay.get(u) ?? 0) + delta);
    audDay.set(a, (audDay.get(a) ?? 0) + delta);
  };

  /** Cases possibles pour une séance, triées par score (préférences P1..P4). */
  const candidates = (s: SessionReq) => {
    const out: { day: Day; slot: SlotDef; roomId: string | null; score: number }[] = [];
    days.forEach((day, di) => {
      slots.forEach((slot, si) => {
        if (!audienceFree(day, slot.id, s.audience) || !teacherOk(s, day, slot)) return;
        const roomId = pickRoom(s, day, slot);
        if (roomId === undefined) return;
        const score = (ueDay.get(`${s.teachingUnitId}|${day}`) ?? 0) * 10 + (audDay.get(`${AUD(s.audience)}|${day}`) ?? 0) * 2 + si * 0.1 + di * 0.01;
        out.push({ day, slot, roomId, score });
      });
    });
    return out.sort((a, b) => a.score - b.score);
  };

  /** Explique pourquoi une séance ne trouve aucune case. */
  const diagnose = (s: SessionReq): string => {
    if (input.rooms.length && !staticRooms.get(s.key)!.length) {
      return `aucune salle ne convient (type ${s.type}, ${s.size} étudiant(s))`;
    }
    let teacher = 0, audience = 0, room = 0;
    for (const day of days) for (const slot of slots) {
      if (!audienceFree(day, slot.id, s.audience)) audience++;
      else if (!teacherOk(s, day, slot)) teacher++;
      else if (pickRoom(s, day, slot) === undefined) room++;
    }
    const max = Math.max(teacher, audience, room);
    if (max === teacher) return "l'enseignant n'est disponible sur aucune case libre (indisponibilités ou autres cours)";
    if (max === room) return 'aucune salle adaptée libre sur les cases restantes';
    return 'la grille du niveau est pleine pour ce public';
  };

  // ---- 1. Séances épinglées ----
  const placed: Placed[] = [];
  for (const l of input.locked ?? []) { reserve(l, 1); placed.push(l); }

  // ---- 2. Tri "le plus contraint d'abord" ----
  const domain = new Map(input.sessions.map((s) => [s.key, candidates(s).length]));
  const typeRank = { CM: 0, TD: 1, TP: 2 };
  const order = [...input.sessions].sort(
    (a, b) => domain.get(a.key)! - domain.get(b.key)! || typeRank[a.type] - typeRank[b.type] || b.size - a.size || a.key.localeCompare(b.key),
  );

  // ---- 3. Retour arrière ----
  let steps = 0;
  const chosen: Placed[] = [];
  const solve = (i: number): boolean | 'budget' => {
    if (i === order.length) return true;
    const s = order[i]!;
    for (const c of candidates(s)) {
      if (++steps > maxSteps) return 'budget';
      const p: Placed = { ...s, day: c.day, timeslotId: c.slot.id, roomId: c.roomId };
      reserve(p, 1);
      chosen.push(p);
      const r = solve(i + 1);
      if (r === true || r === 'budget') return r;
      chosen.pop();
      reserve(p, -1); // retour arrière
    }
    return false;
  };
  const result = order.length ? solve(0) : true;
  if (result === true) return { placed: [...placed, ...chosen], unplaced: [], warnings, strategy: 'backtracking', steps };

  // ---- 4. Repli glouton : placer le maximum, expliquer le reste ----
  for (const p of chosen.splice(0)) reserve(p, -1);
  const unplaced: Unplaced[] = [];
  for (const s of order) {
    const c = candidates(s)[0];
    if (!c) { unplaced.push({ session: s, reason: diagnose(s) }); continue; }
    const p: Placed = { ...s, day: c.day, timeslotId: c.slot.id, roomId: c.roomId };
    reserve(p, 1);
    placed.push(p);
  }
  if (result === 'budget') warnings.push(`Recherche complète interrompue après ${maxSteps} essais : résultat du placement glouton.`);
  return { placed, unplaced, warnings, strategy: 'glouton', steps };
}

// ═══════════════════════════════════════════════════════════════════════════
//  Préparation des séances à partir des volumes horaires
// ═══════════════════════════════════════════════════════════════════════════

/** Durée d'un créneau en heures ("08:00"→"10:00" = 2). */
export const slotHours = (s: { startTime: string; endTime: string }) => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return (m(s.endTime) - m(s.startTime)) / 60;
};

/**
 * Nombre de séances hebdomadaires pour un volume semestriel :
 *   ⌈ volume / (semaines × durée d'un créneau) ⌉   (au moins 1 si le volume > 0)
 * ex. CM 30 h sur 14 semaines, créneaux de 2 h → ⌈30 / 28⌉ = 2 séances par semaine.
 */
export function weeklySessions(hours: number, weeks: number, slotDuration: number) {
  if (hours <= 0) return 0;
  return Math.max(1, Math.ceil(hours / (weeks * slotDuration) - 1e-9));
}

/**
 * Répartit n séances entre les enseignants affectés, proportionnellement à leurs
 * heures (méthode du plus fort reste). Sans enseignant → [null × n].
 */
export function splitSessions(n: number, teachers: { teacherId: string; hours: number }[]): (string | null)[] {
  if (!teachers.length) return Array(n).fill(null);
  const total = teachers.reduce((a, t) => a + t.hours, 0) || teachers.length;
  const raw = teachers.map((t) => ({ id: t.teacherId, exact: (n * (t.hours || 1)) / total }));
  const out = raw.map((r) => ({ id: r.id, k: Math.floor(r.exact), rest: r.exact - Math.floor(r.exact) }));
  let missing = n - out.reduce((a, o) => a + o.k, 0);
  for (const o of [...out].sort((a, b) => b.rest - a.rest)) { if (missing-- <= 0) break; o.k++; }
  return out.flatMap((o) => Array(o.k).fill(o.id));
}
