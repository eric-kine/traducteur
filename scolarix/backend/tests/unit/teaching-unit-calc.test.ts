import { describe, expect, it } from 'vitest';
import {
  computeCost,
  computePaidHours,
  computeTotalHours,
  createTeachingUnitSchema,
  weightsSum,
} from '@scolarix/shared';
import { computeHours } from '../../src/modules/teaching-units/teaching-units.service';

describe('calcul des volumes horaires', () => {
  it('total = CM + TD + TP', () => {
    expect(computeTotalHours({ cmHours: 24, tdHours: 18, tpHours: 12 })).toBe(54);
  });

  it('sans erreur d’arrondi (0,1 + 0,2 = 0,3)', () => {
    expect(computeTotalHours({ cmHours: 0.1, tdHours: 0.2, tpHours: 0 })).toBe(0.3);
    expect(computeTotalHours({ cmHours: 10.25, tdHours: 7.5, tpHours: 0.75 })).toBe(18.5);
  });

  it('valeurs manquantes = 0', () => {
    expect(computeTotalHours({ cmHours: 12 })).toBe(12);
    expect(computeTotalHours({ cmHours: null, tdHours: undefined, tpHours: 6 })).toBe(6);
  });

  it('volume payé en équivalent TD : CM × 1,5 + TD + TP', () => {
    expect(computePaidHours({ cmHours: 24, tdHours: 18, tpHours: 12 })).toBe(66);
    expect(computePaidHours({ cmHours: 0.5, tdHours: 0, tpHours: 0 })).toBe(0.75);
  });

  it('coût estimé = volume payé × taux horaire', () => {
    expect(computeCost(66, 10000)).toBe(660000);
    expect(computeCost(37.5, 12.5)).toBe(468.75);
    expect(computeCost(66, null)).toBeNull();
  });

  it('somme des pondérations', () => {
    expect(weightsSum({ ccWeight: 30, examWeight: 50, tpWeight: 20 })).toBe(100);
  });
});

describe('computeHours (serveur)', () => {
  it('mode automatique quand paidHours est absent', () => {
    expect(computeHours({ cmHours: 20, tdHours: 10, tpHours: 0 })).toEqual({ totalHours: 30, paidHoursAuto: true, paidHours: 40 });
  });
  it('mode manuel quand paidHours est fourni', () => {
    expect(computeHours({ cmHours: 20, tdHours: 10, tpHours: 0, paidHours: 35 })).toEqual({
      totalHours: 30,
      paidHoursAuto: false,
      paidHours: 35,
    });
  });
});

describe('validation Zod d’une UE', () => {
  const base = { code: 'inf101', title: 'Algorithmique', semester: 1, credits: 6, coefficient: 2, cmHours: 20, tdHours: 10 };

  it('accepte une UE valide et applique les valeurs par défaut', () => {
    const r = createTeachingUnitSchema.parse(base);
    expect(r).toMatchObject({ code: 'INF101', tpHours: 0, ccWeight: 40, examWeight: 60, tpWeight: 0 });
  });
  it('convertit les champs de formulaire ("" → null, "12" → 12)', () => {
    const r = createTeachingUnitSchema.parse({ ...base, cmHours: '12', paidHours: '', hourlyRate: '', specialtyId: '' });
    expect(r).toMatchObject({ cmHours: 12, paidHours: null, hourlyRate: null, specialtyId: null });
  });
  it('refuse 0 heure au total', () => {
    expect(createTeachingUnitSchema.safeParse({ ...base, cmHours: 0, tdHours: 0 }).success).toBe(false);
  });
  it('refuse des pondérations ≠ 100 %', () => {
    const r = createTeachingUnitSchema.safeParse({ ...base, ccWeight: 50, examWeight: 40 });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error)).toContain('90 %');
  });
  it('refuse heures négatives, 3 décimales, semestre 3', () => {
    expect(createTeachingUnitSchema.safeParse({ ...base, tdHours: -1 }).success).toBe(false);
    expect(createTeachingUnitSchema.safeParse({ ...base, tdHours: 1.234 }).success).toBe(false);
    expect(createTeachingUnitSchema.safeParse({ ...base, semester: 3 }).success).toBe(false);
  });
});
