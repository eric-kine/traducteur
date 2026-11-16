/**
 * Génère l'aperçu du gabarit de relevé avec des données fictives :
 *   npm run preview:documents -w backend
 * → docs/apercu-releve.html et docs/apercu-releve.pdf
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { renderTranscript } from '../src/pdf/templates/transcript';
import { sampleTranscript } from '../src/pdf/templates/transcript.sample';
import { closePdfBrowser, htmlToPdf } from '../src/pdf/pdf.service';
import { renderCertificate } from '../src/pdf/templates/certificate';
import { qrSvg } from '../src/pdf/qr';
import { renderSyllabus } from '../src/pdf/templates/syllabus';
import type { SyllabusDto } from '@scolarix/shared';

const out = path.resolve(import.meta.dirname, '../../docs');
const html = renderTranscript(sampleTranscript(), await qrSvg('https://scolarix.example/verifier/K7Q2M9XH4P'));
await fs.writeFile(path.join(out, 'apercu-releve.html'), html);
await fs.writeFile(path.join(out, 'apercu-releve.pdf'), await htmlToPdf(html));

// Certificat de scolarité (données fictives)
const t = sampleTranscript();
const cert = {
  number: 'CS-2026-00042', orderNumber: 42, verificationCode: 'K7Q2M9XH4P',
  verificationUrl: 'https://scolarix.example/verifier/K7Q2M9XH4P', issuedAt: '2026-10-05T09:00:00.000Z',
  purpose: 'Demande de bourse', institute: t.institute, school: t.school,
  student: { ...t.student, nationality: 'Sénégalaise' },
  academicYear: { label: '2026-2027', startDate: '2026-09-01', endDate: '2027-07-31' },
  level: { ...t.level, cycle: 'LICENCE' }, specialty: t.specialty, isRepeating: false, isPastYear: false,
};
const certHtml = renderCertificate(cert, { qr: await qrSvg(cert.verificationUrl) });
await fs.writeFile(path.join(out, 'apercu-certificat.html'), certHtml);
await fs.writeFile(path.join(out, 'apercu-certificat.pdf'), await htmlToPdf(certHtml));

// Syllabus (données fictives)
const syl: SyllabusDto = {
  academicYear: { id: 'x', label: '2026-2027' }, exists: true, status: 'PUBLIE', updatedAt: '2026-09-20T10:00:00.000Z', updatedBy: 'Dr Ousmane Fall', canEdit: false,
  teachingUnit: {
    id: 'x', code: 'INF101', title: 'Algorithmique et structures de données', description: null, semester: 1, credits: 6, coefficient: 3,
    cmHours: 30, tdHours: 18, tpHours: 12, totalHours: 60, ccWeight: 30, examWeight: 50, tpWeight: 20,
    objectives: "Concevoir, analyser et implémenter des algorithmes classiques.\n- Raisonner sur la correction d'un algorithme\n- Estimer sa complexité",
    prerequisites: 'Mathématiques de terminale (suites, logique).', bibliography: 'T. Cormen et al., Algorithmique, Dunod\nR. Sedgewick, Algorithmes en Java, Pearson',
  },
  level: { id: 'x', code: 'L1', name: 'Licence 1' }, specialty: null,
  school: t.school, institute: t.institute,
  teachers: [
    { title: 'Dr', firstName: 'Ousmane', lastName: 'Fall', email: 'o.fall@isp.example', grade: 'Maître de conférences', sessionTypes: ['CM'], isCoordinator: true },
    { title: 'M.', firstName: 'Ibrahima', lastName: 'Sow', email: 'i.sow@isp.example', grade: 'Assistant', sessionTypes: ['TD', 'TP'], isCoordinator: false },
  ],
  fields: {
    objectives: null, prerequisites: null, bibliography: null,
    competencies: '- Concevoir un algorithme efficace\n- Choisir une structure de données adaptée',
    content: [
      { title: "Introduction à l'algorithmique", sessionType: 'CM', hours: 10, description: 'Pseudo-code, preuve, invariants' },
      { title: 'Structures de données linéaires', sessionType: 'CM', hours: 20, description: 'Tableaux, listes, piles, files' },
      { title: 'Exercices de tri et de recherche', sessionType: 'TD', hours: 18, description: null },
      { title: 'Implémentation en Python', sessionType: 'TP', hours: 12, description: 'Projet en binôme' },
    ],
    teachingMethods: '- Cours magistraux illustrés\n- TD en petits groupes\n- Projet de programmation',
    evaluationMethods: 'Deux devoirs surveillés et le projet composent le contrôle continu. Examen écrit de 2 h sans document.',
  },
};
const sylHtml = renderSyllabus(syl, '2026-09-21T08:00:00.000Z');
await fs.writeFile(path.join(out, 'apercu-syllabus.html'), sylHtml);
await fs.writeFile(path.join(out, 'apercu-syllabus.pdf'), await htmlToPdf(sylHtml, { footerText: 'Syllabus INF101 — Algorithmique et structures de données · EIT · 2026-2027' }));

await closePdfBrowser();
console.log('✅ docs/apercu-{releve,certificat,syllabus}.{html,pdf} générés');
