/**
 * RÈGLES DE CALCUL DES NOTES (documentées dans docs/MODULE-04-NOTES.md)
 * Code partagé : le serveur (relevés, délibération) et l'écran de saisie
 * (calcul en direct) utilisent exactement les mêmes fonctions.
 * Calculs en centièmes de point (entiers) : pas d'erreur d'arrondi.
 */

/** Paramètres du règlement des études — modifiables ici, en un seul endroit. */
export const GRADING_RULES = {
  /** Note minimale pour valider une UE et pour être admis (sur 20). */
  passMark: 10,
  /** Compensation entre UE d'un même semestre (moyenne semestrielle ≥ passMark). */
  compensation: true,
  /** En dessous de cette note, une UE ne peut pas être compensée (note éliminatoire). */
  eliminatoryMark: 5,
  /**
   * Admission "avec dettes" si la part des crédits acquis atteint ce ratio (ex. 0.75).
   * null = désactivé : la décision est ADMIS ou AJOURNÉ (redoublant).
   */
  carryOverMinRatio: null as number | null,
  /** Mentions selon la moyenne annuelle (attribuées aux seuls admis). */
  mentions: [
    { min: 16, label: 'Très bien' },
    { min: 14, label: 'Bien' },
    { min: 12, label: 'Assez bien' },
    { min: 10, label: 'Passable' },
  ],
};

export type UeStatus = 'V' | 'VC' | 'NV' | 'INC';
export const UE_STATUS_LABELS: Record<UeStatus, string> = {
  V: 'Validée', VC: 'Validée par compensation', NV: 'Non validée', INC: 'Incomplète',
};

export type Decision = 'ADMIS' | 'ADMIS_AVEC_DETTES' | 'AJOURNE' | 'INCOMPLET';
export const DECISION_LABELS: Record<Decision, string> = {
  ADMIS: 'Admis(e)', ADMIS_AVEC_DETTES: 'Admis(e) avec dettes', AJOURNE: 'Ajourné(e) — redouble', INCOMPLET: 'Résultats incomplets',
};

export interface Weights { ccWeight: number; examWeight: number; tpWeight: number }
export interface Scores { ccScore: number | null; examScore: number | null; tpScore: number | null; isAbsent: boolean }

const cents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => Math.round(c) / 100;
const has = (v: number | null | undefined): v is number => v !== null && v !== undefined && !Number.isNaN(v);

/**
 * Note finale d'une UE (/20) = (CC × %CC + Examen × %Examen + TP × %TP) / 100.
 *  - seules les composantes dont la pondération est > 0 sont requises ;
 *  - absent à l'examen → l'examen compte 0 ;
 *  - une composante requise manquante → null (note pas encore calculable).
 */
export function computeUeFinal(w: Weights, s: Scores): number | null {
  const exam = s.isAbsent ? 0 : s.examScore;
  if ((w.ccWeight > 0 && !has(s.ccScore)) || (w.examWeight > 0 && !has(exam)) || (w.tpWeight > 0 && !has(s.tpScore))) return null;
  const total =
    (w.ccWeight > 0 ? cents(s.ccScore!) * w.ccWeight : 0) +
    (w.examWeight > 0 ? cents(exam!) * w.examWeight : 0) +
    (w.tpWeight > 0 ? cents(s.tpScore!) * w.tpWeight : 0);
  return fromCents(total / 100);
}

/**
 * Note de rattrapage : la note d'examen de rattrapage remplace celle de la
 * session normale ; le CC est conservé ; le TP aussi, sauf s'il est ressaisi.
 */
export function computeRetakeFinal(w: Weights, normal: Scores | null, retake: Scores): number | null {
  return computeUeFinal(w, {
    ccScore: normal?.ccScore ?? null,
    examScore: retake.examScore,
    tpScore: has(retake.tpScore) ? retake.tpScore : (normal?.tpScore ?? null),
    isAbsent: retake.isAbsent,
  });
}

/** Note retenue : la meilleure des deux sessions. */
export function retainedFinal(normal: number | null, retake: number | null): { final: number | null; session: 'NORMALE' | 'RATTRAPAGE' | null } {
  if (has(retake) && (!has(normal) || retake > normal)) return { final: retake, session: 'RATTRAPAGE' };
  if (has(normal)) return { final: normal, session: 'NORMALE' };
  return { final: null, session: null };
}

/** Moyenne pondérée par les coefficients : Σ(note × coef) / Σ coef. null si une note manque. */
export function weightedAverage(units: { final: number | null; coefficient: number }[]): number | null {
  if (!units.length || units.some((u) => !has(u.final))) return null;
  const coefSum = units.reduce((a, u) => a + cents(u.coefficient), 0);
  if (!coefSum) return null;
  const sum = units.reduce((a, u) => a + cents(u.final!) * cents(u.coefficient), 0);
  return fromCents(sum / coefSum);
}

export interface UnitInput { credits: number; coefficient: number; final: number | null }
export interface UnitResult extends UnitInput { status: UeStatus; creditsEarned: number }

export interface SemesterResult {
  average: number | null;
  totalCredits: number;
  creditsEarned: number;
  units: UnitResult[];
}

/**
 * Résultat d'un semestre :
 *  - moyenne = moyenne des UE pondérée par les coefficients ;
 *  - UE validée (V) si note ≥ 10 ;
 *  - sinon validée par compensation (VC) si la moyenne du semestre ≥ 10
 *    et la note ≥ note éliminatoire (5) ;
 *  - crédits acquis = somme des crédits des UE V ou VC.
 */
export function computeSemester<T extends UnitInput>(units: T[], rules = GRADING_RULES): Omit<SemesterResult, 'units'> & { units: (T & UnitResult)[] } {
  const average = weightedAverage(units);
  const canCompensate = rules.compensation && has(average) && average >= rules.passMark;
  const results = units.map((u) => {
    let status: UeStatus;
    if (!has(u.final)) status = 'INC';
    else if (u.final >= rules.passMark) status = 'V';
    else if (canCompensate && u.final >= rules.eliminatoryMark) status = 'VC';
    else status = 'NV';
    return { ...u, status, creditsEarned: status === 'V' || status === 'VC' ? u.credits : 0 };
  });
  return {
    average,
    totalCredits: units.reduce((a, u) => a + u.credits, 0),
    creditsEarned: results.reduce((a, u) => a + u.creditsEarned, 0),
    units: results,
  };
}

export function mentionFor(average: number | null, rules = GRADING_RULES): string | null {
  if (!has(average)) return null;
  return rules.mentions.find((m) => average >= m.min)?.label ?? null;
}

export interface YearResult {
  average: number | null;
  totalCredits: number;
  creditsEarned: number;
  decision: Decision;
  mention: string | null;
}

/**
 * Résultat annuel :
 *  - moyenne annuelle = moyenne de TOUTES les UE de l'année pondérée par les coefficients ;
 *  - ADMIS si toutes les UE sont validées (V ou VC) ;
 *  - ADMIS AVEC DETTES si l'option est activée et la part de crédits acquis ≥ ratio ;
 *  - sinon AJOURNÉ (redoublant) ;
 *  - INCOMPLET tant qu'une note manque ;
 *  - mention selon la moyenne annuelle, pour les admis uniquement.
 */
export function computeYear(semesters: SemesterResult[], rules = GRADING_RULES): YearResult {
  const allUnits = semesters.flatMap((s) => s.units);
  const totalCredits = semesters.reduce((a, s) => a + s.totalCredits, 0);
  const creditsEarned = semesters.reduce((a, s) => a + s.creditsEarned, 0);
  const average = weightedAverage(allUnits);
  let decision: Decision;
  if (!allUnits.length || !has(average)) decision = 'INCOMPLET';
  else if (allUnits.every((u) => u.status === 'V' || u.status === 'VC')) decision = 'ADMIS';
  else if (rules.carryOverMinRatio !== null && totalCredits > 0 && creditsEarned / totalCredits >= rules.carryOverMinRatio) decision = 'ADMIS_AVEC_DETTES';
  else decision = 'AJOURNE';
  const admitted = decision === 'ADMIS' || decision === 'ADMIS_AVEC_DETTES';
  return { average, totalCredits, creditsEarned, decision, mention: admitted ? mentionFor(average, rules) : null };
}

/** Affichage français d'une note : 12,5 ; null → "—" */
export const formatScore = (n: number | null | undefined) =>
  has(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
