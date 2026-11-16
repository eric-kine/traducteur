/**
 * Génère l'aperçu du gabarit de relevé avec des données fictives :
 *   npm run preview:transcript -w backend
 * → docs/apercu-releve.html et docs/apercu-releve.pdf
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { renderTranscript } from '../src/pdf/templates/transcript';
import { sampleTranscript } from '../src/pdf/templates/transcript.sample';
import { closePdfBrowser, htmlToPdf } from '../src/pdf/pdf.service';

const out = path.resolve(import.meta.dirname, '../../docs');
const html = renderTranscript(sampleTranscript());
await fs.writeFile(path.join(out, 'apercu-releve.html'), html);
await fs.writeFile(path.join(out, 'apercu-releve.pdf'), await htmlToPdf(html));
await closePdfBrowser();
console.log('✅ docs/apercu-releve.html et docs/apercu-releve.pdf générés');
