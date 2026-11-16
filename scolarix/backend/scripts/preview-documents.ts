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

await closePdfBrowser();
console.log('✅ docs/apercu-releve.(html|pdf) et docs/apercu-certificat.(html|pdf) générés');
