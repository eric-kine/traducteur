import { z } from 'zod';
import { SESSION_TYPES } from '../enums';
import { codeSchema, optionalText } from './common';

export const WEEKDAYS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  LUNDI: 'Lundi', MARDI: 'Mardi', MERCREDI: 'Mercredi', JEUDI: 'Jeudi', VENDREDI: 'Vendredi', SAMEDI: 'Samedi',
};

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure au format HH:MM');
/** Indisponibilités : liste de cases { jour, heure de début du créneau }. */
export const unavailabilitySchema = z.array(z.object({ day: z.enum(WEEKDAYS), start: time })).max(200);
export type Unavailability = z.infer<typeof unavailabilitySchema>;

export const roomSchema = z.object({
  code: codeSchema(15),
  name: optionalText(100),
  building: optionalText(100),
  capacity: z.coerce.number().int().min(1, 'Au moins 1 place').max(2000),
  supportedTypes: z.array(z.enum(SESSION_TYPES)).min(1, 'Choisissez au moins un type de séance'),
  isActive: z.boolean().optional(),
  unavailability: unavailabilitySchema.optional(),
});
export type RoomInput = z.input<typeof roomSchema>;
export const updateRoomSchema = roomSchema.partial().refine((d) => Object.keys(d).length > 0, { message: 'Aucun champ à modifier' });

/** Grille horaire : créneaux sans chevauchement, triés. */
export const timeslotsSchema = z
  .object({ slots: z.array(z.object({ startTime: time, endTime: time })).min(1).max(12) })
  .superRefine(({ slots }, ctx) => {
    const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    sorted.forEach((s, i) => {
      if (s.startTime >= s.endTime) ctx.addIssue({ code: 'custom', path: ['slots'], message: `Créneau ${s.startTime}-${s.endTime} : la fin doit suivre le début` });
      const next = sorted[i + 1];
      if (next && next.startTime < s.endTime) ctx.addIssue({ code: 'custom', path: ['slots'], message: `Les créneaux ${s.startTime}-${s.endTime} et ${next.startTime}-${next.endTime} se chevauchent` });
    });
  });

export const generateScheduleSchema = z.object({
  levelId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  semester: z.coerce.number().int().min(1).max(2),
  /** Semaines d'enseignement : séances hebdo = ⌈volume / (semaines × durée d'un créneau)⌉ */
  weeks: z.coerce.number().int().min(1).max(30).default(14),
});
export type GenerateScheduleInput = z.input<typeof generateScheduleSchema>;

export const moveSessionSchema = z
  .object({
    day: z.enum(WEEKDAYS),
    timeslotId: z.string().uuid(),
    roomId: z.string().uuid().nullable(),
    teacherId: z.string().uuid().nullable(),
    locked: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucun champ à modifier' });
export type MoveSessionInput = z.infer<typeof moveSessionSchema>;

export const addSessionSchema = z.object({
  teachingUnitId: z.string().uuid(),
  sessionType: z.enum(SESSION_TYPES),
  day: z.enum(WEEKDAYS),
  timeslotId: z.string().uuid(),
  teacherId: z.string().uuid().nullable().optional(),
  roomId: z.string().uuid().nullable().optional(),
});

export const timetableViewQuerySchema = z.object({
  academicYearId: z.string().uuid(),
  semester: z.coerce.number().int().min(1).max(2),
  format: z.enum(['json', 'pdf']).default('json'),
});
