import { computeSemester, computeUeFinal, computeYear, type TranscriptData } from '@scolarix/shared';

type Row = { code: string; title: string; credits: number; coefficient: number; w: [number, number, number]; cc: number | null; exam: number | null; tp: number | null; abs?: boolean; retake?: boolean };

/** La note finale est calculée avec la vraie formule (pondérations CC/Examen/TP). */
const unit = (r: Row) => ({
  code: r.code, title: r.title, credits: r.credits, coefficient: r.coefficient,
  ccScore: r.cc, examScore: r.exam, tpScore: r.tp, isAbsent: !!r.abs,
  final: computeUeFinal({ ccWeight: r.w[0], examWeight: r.w[1], tpWeight: r.w[2] }, { ccScore: r.cc, examScore: r.exam, tpScore: r.tp, isAbsent: !!r.abs }),
  session: (r.retake ? 'RATTRAPAGE' : 'NORMALE') as 'NORMALE' | 'RATTRAPAGE',
});

/** Données fictives pour l'aperçu du gabarit (aucune donnée réelle). */
export function sampleTranscript(): TranscriptData {
  const s1 = computeSemester([
    unit({ code: 'INF101', title: 'Algorithmique et structures de données', credits: 6, coefficient: 3, w: [30, 50, 20], cc: 14, exam: 12.5, tp: 16 }),
    unit({ code: 'MAT101', title: 'Analyse mathématique', credits: 5, coefficient: 2, w: [40, 60, 0], cc: 9, exam: 7, tp: null }),
    unit({ code: 'ANG101', title: 'Anglais technique', credits: 2, coefficient: 1, w: [40, 60, 0], cc: 15, exam: 16, tp: null }),
  ]);
  const s2 = computeSemester([
    unit({ code: 'GL201', title: 'Programmation orientée objet', credits: 5, coefficient: 2, w: [30, 50, 20], cc: 12, exam: 11, tp: 14, retake: true }),
    unit({ code: 'RES201', title: 'Introduction aux réseaux', credits: 4, coefficient: 2, w: [40, 60, 0], cc: 13, exam: 9.5, tp: null }),
  ]);
  const semesters = [
    { number: 1, average: s1.average, totalCredits: s1.totalCredits, creditsEarned: s1.creditsEarned, units: s1.units },
    { number: 2, average: s2.average, totalCredits: s2.totalCredits, creditsEarned: s2.creditsEarned, units: s2.units },
  ];
  return {
    reference: 'RN-2026-000123',
    verificationCode: 'K7Q2M9XH4P',
    issuedAt: '2027-07-15T10:00:00.000Z',
    institute: {
      name: 'Institut Supérieur Polytechnique', acronym: 'ISP', address: 'Avenue de l’Université', city: 'Dakar', country: 'Sénégal',
      phone: '+221 33 800 00 00', email: 'contact@isp.example', website: 'https://isp.example', directorName: 'Pr Mariama Ndiaye',
    },
    school: { code: 'EIT', name: "École d'Ingénieurs et de Technologie", directorName: 'Dr Ousmane Fall' },
    student: { matricule: 'EIT-2026-00042', firstName: 'Awa', lastName: 'Diallo', birthDate: '2005-03-15', birthPlace: 'Dakar', gender: 'F' },
    academicYear: '2026-2027',
    level: { code: 'L1', name: 'Licence 1' },
    specialty: { code: 'GL', name: 'Génie Logiciel', diplomaTitle: 'Licence en Génie Logiciel' },
    semesters,
    year: computeYear(semesters),
    deliberatedAt: '2027-07-10T00:00:00.000Z',
    isProvisional: false,
  };
}
