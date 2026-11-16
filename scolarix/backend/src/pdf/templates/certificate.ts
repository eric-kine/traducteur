import type { CertificateData } from '@scolarix/shared';
import { BASE_CSS, esc, frDate, SCOLARIX_LOGO } from './common';

/**
 * Gabarit A4 du certificat de scolarité. Toutes les valeurs sont échappées ;
 * le QR code (SVG généré par le serveur) pointe vers la page de vérification.
 */
export function renderCertificate(d: CertificateData, opts: { qr?: string; duplicate?: boolean; revoked?: boolean; preview?: boolean } = {}): string {
  const i = d.institute;
  const s = d.student;
  const female = s.gender === 'F';
  const e = (m: string, f: string) => (female ? f : m);
  const signatory = d.school.directorName ?? i.directorName;
  const contact = [i.address, [i.city, i.country].filter(Boolean).join(', '), i.phone, i.email].filter(Boolean).map(esc).join(' · ');
  const watermark = opts.revoked ? 'ANNULÉ' : opts.preview ? 'APERÇU' : '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Certificat de scolarité ${esc(d.number)} — ${esc(s.lastName)} ${esc(s.firstName)}</title>
<style>
  ${BASE_CSS}
  body { font-size: 11pt; }
  .number { text-align: center; font-family: "DejaVu Sans Mono", monospace; font-size: 10.5pt; margin-top: 4px; }
  .body { margin: 26px 6px 0; line-height: 1.85; text-align: justify; }
  .body p { margin: 0 0 12px; }
  .who { margin: 14px 0 18px 28px; border-left: 3px solid #1e4fa3; padding: 4px 0 4px 16px; line-height: 1.7; }
  .who b { font-size: 12pt; }
  .who span { display: inline-block; min-width: 150px; color: #4b5563; }
  .bottom { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid; }
  .verify { display: flex; gap: 10px; align-items: center; font-size: 7.5pt; color: #4b5563; max-width: 52%; }
  .verify svg { width: 84px; height: 84px; flex: none; }
  .verify code { display: block; font-family: "DejaVu Sans Mono", monospace; font-size: 9pt; color: #111827; margin: 2px 0; }
  .sign { text-align: center; width: 44%; }
  .sign .line { margin-top: 56px; border-top: 1px solid #9ca3af; padding-top: 3px; font-size: 9pt; }
  .dup { display: inline-block; margin-top: 6px; font-size: 8pt; color: #b91c1c; font-weight: 700; border: 1px solid #b91c1c; padding: 1px 8px; letter-spacing: 1px; }
</style>
</head>
<body>
  ${watermark ? `<div class="watermark">${watermark}</div>` : ''}
  <header class="header">
    <div class="brand">${SCOLARIX_LOGO}<span>Scolarix</span></div>
    <div class="inst">
      <h1>${esc(i.name)}${i.acronym ? ` (${esc(i.acronym)})` : ''}</h1>
      <div class="school">${esc(d.school.name)}</div>
      <div class="contact">${contact}</div>
    </div>
    <div class="ref">Année académique<strong>${esc(d.academicYear.label)}</strong></div>
  </header>

  <div class="title" style="margin-top:28px">
    <h2>CERTIFICAT DE SCOLARITÉ</h2>
    <div class="number">N° ${esc(d.number)}</div>
    ${opts.duplicate ? '<div class="dup">DUPLICATA</div>' : ''}
  </div>

  <section class="body">
    <p>
      Le/La soussigné(e), ${signatory ? `<b>${esc(signatory)}</b>, ` : ''}
      Directeur / Directrice de l'établissement <b>${esc(d.school.directorName ? d.school.name : i.name)}</b>,
      certifie que :
    </p>
    <div class="who">
      <b>${e('M.', 'Mme')} ${esc(s.lastName.toUpperCase())} ${esc(s.firstName)}</b><br/>
      <span>${e('Né', 'Née')} le</span>${esc(frDate(s.birthDate))} à ${esc(s.birthPlace)}<br/>
      ${s.nationality ? `<span>Nationalité</span>${esc(s.nationality)}<br/>` : ''}
      <span>Matricule</span><b class="mono">${esc(s.matricule)}</b>
    </div>
    <p>
      ${d.isPastYear ? 'était' : 'est'} régulièrement ${e('inscrit', 'inscrite')} en <b>${esc(d.level.name)}</b>${d.specialty ? `, spécialité <b>${esc(d.specialty.name)}</b>,` : ''}
      au sein de l'établissement <b>${esc(d.school.name)}</b> au titre de l'année académique <b>${esc(d.academicYear.label)}</b>
      (du ${esc(frDate(d.academicYear.startDate))} au ${esc(frDate(d.academicYear.endDate))})${d.isRepeating ? `, en qualité de ${e('redoublant', 'redoublante')}` : ''}.
    </p>
    ${d.specialty?.diplomaTitle ? `<p>Diplôme préparé : <b>${esc(d.specialty.diplomaTitle)}</b>.</p>` : ''}
    <p>
      En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit${d.purpose ? ` (motif : ${esc(d.purpose)})` : ''}.
    </p>
  </section>

  <section class="bottom">
    <div class="verify">
      ${opts.qr ?? ''}
      <div>
        ${d.verificationCode ? `Authenticité vérifiable en ligne en scannant ce code ou sur<br/><code>${esc(d.verificationUrl ?? '')}</code>Code : <code>${esc(d.verificationCode)}</code>` : ''}
      </div>
    </div>
    <div class="sign">
      Fait à ${esc(i.city ?? '……………')}, le ${esc(frDate(d.issuedAt))}<br/>
      <b>${d.school.directorName ? "Le Directeur / La Directrice de l'école" : 'Le Directeur / La Directrice'}</b>
      <div class="line">${esc(signatory ?? '')}</div>
    </div>
  </section>
</body>
</html>`;
}
