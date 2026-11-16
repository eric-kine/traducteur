import { describe, expect, it } from 'vitest';
import {
  computeRetakeFinal, computeSemester, computeUeFinal, computeYear, GRADING_RULES, mentionFor, retainedFinal, weightedAverage,
} from '@scolarix/shared';

const W = { ccWeight: 40, examWeight: 60, tpWeight: 0 };
const S = (cc: number | null, exam: number | null, tp: number | null = null, isAbsent = false) => ({ ccScore: cc, examScore: exam, tpScore: tp, isAbsent });

describe('note d’une UE', () => {
  it('CC × 40 % + Examen × 60 %', () => expect(computeUeFinal(W, S(12, 8))).toBe(9.6));
  it('avec TP (30/50/20)', () => expect(computeUeFinal({ ccWeight: 30, examWeight: 50, tpWeight: 20 }, S(14, 12.5, 16))).toBe(13.65));
  it('absent à l’examen → examen compté 0', () => expect(computeUeFinal(W, S(15, null, null, true))).toBe(6));
  it('note requise manquante → null', () => {
    expect(computeUeFinal(W, S(12, null))).toBeNull();
    expect(computeUeFinal(W, S(null, 12))).toBeNull();
  });
  it('composante à 0 % non requise', () => expect(computeUeFinal({ ccWeight: 0, examWeight: 100, tpWeight: 0 }, S(null, 13.5))).toBe(13.5));
  it('pas d’erreur d’arrondi', () => expect(computeUeFinal(W, S(10.1, 10.2))).toBe(10.16));
});

describe('rattrapage', () => {
  it('l’examen de rattrapage remplace l’examen, le CC est conservé', () => {
    expect(computeRetakeFinal(W, S(12, 6), S(null, 11))).toBe(11.4); // 12×0,4 + 11×0,6
  });
  it('on garde la meilleure des deux sessions', () => {
    expect(retainedFinal(8, 11.4)).toEqual({ final: 11.4, session: 'RATTRAPAGE' });
    expect(retainedFinal(9, 7)).toEqual({ final: 9, session: 'NORMALE' });
    expect(retainedFinal(null, null)).toEqual({ final: null, session: null });
  });
});

describe('semestre', () => {
  it('moyenne pondérée par les coefficients', () => {
    expect(weightedAverage([{ final: 13.65, coefficient: 3 }, { final: 7.8, coefficient: 2 }, { final: 15.6, coefficient: 1 }])).toBe(12.03);
  });
  it('validation directe, par compensation, ou non validée', () => {
    const r = computeSemester([
      { credits: 6, coefficient: 3, final: 14 },
      { credits: 5, coefficient: 2, final: 7 }, // ≥ 5 et moyenne ≥ 10 → compensée
      { credits: 2, coefficient: 1, final: 4 }, // < 5 → note éliminatoire
    ]);
    expect(r.average).toBe(10); // (14×3 + 7×2 + 4×1) / 6
    expect(r.units.map((u) => u.status)).toEqual(['V', 'VC', 'NV']);
    expect(r.creditsEarned).toBe(11);
    expect(r.totalCredits).toBe(13);
  });
  it('pas de compensation si la moyenne du semestre < 10', () => {
    const r = computeSemester([{ credits: 6, coefficient: 1, final: 11 }, { credits: 6, coefficient: 1, final: 8 }]);
    expect(r.units.map((u) => u.status)).toEqual(['V', 'NV']);
  });
  it('note manquante → INC et moyenne null', () => {
    const r = computeSemester([{ credits: 6, coefficient: 1, final: 14 }, { credits: 6, coefficient: 1, final: null }]);
    expect(r.average).toBeNull();
    expect(r.units[1]!.status).toBe('INC');
  });
});

describe('année, décision et mention', () => {
  const sem = (finals: number[]) => computeSemester(finals.map((final) => ({ credits: 5, coefficient: 1, final })));
  it('ADMIS + mention quand toutes les UE sont validées', () => {
    const y = computeYear([sem([15, 16]), sem([14, 17])]);
    expect(y).toMatchObject({ decision: 'ADMIS', average: 15.5, mention: 'Bien', creditsEarned: 20, totalCredits: 20 });
  });
  it('AJOURNÉ (redoublant) si une UE n’est pas validée, sans mention', () => {
    const y = computeYear([sem([15, 16]), sem([4, 15])]);
    expect(y.decision).toBe('AJOURNE');
    expect(y.mention).toBeNull();
  });
  it('ADMIS AVEC DETTES si l’option est activée', () => {
    const rules = { ...GRADING_RULES, carryOverMinRatio: 0.75 };
    const y = computeYear([computeSemester([{ credits: 5, coefficient: 1, final: 15 }, { credits: 5, coefficient: 1, final: 16 }], rules), computeSemester([{ credits: 5, coefficient: 1, final: 4 }, { credits: 5, coefficient: 1, final: 15 }], rules)], rules);
    expect(y.decision).toBe('ADMIS_AVEC_DETTES');
  });
  it('INCOMPLET tant qu’une note manque', () => {
    expect(computeYear([computeSemester([{ credits: 5, coefficient: 1, final: null }])]).decision).toBe('INCOMPLET');
  });
  it('mentions', () => {
    expect([16, 14, 12, 10, 9.99].map((a) => mentionFor(a))).toEqual(['Très bien', 'Bien', 'Assez bien', 'Passable', null]);
  });
});
