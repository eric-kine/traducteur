import { DECISION_LABELS, formatScore, GRADING_RULES, type TranscriptData, type UeStatus } from '@scolarix/shared';
import { BASE_CSS, esc, frDate, SCOLARIX_LOGO } from './common';

const STATUS_SHORT: Record<UeStatus, string> = { V: 'V', VC: 'VC', NV: 'NV', INC: '—' };

const score = (v: number | null, absent = false) => (absent ? 'ABS' : formatScore(v));

/**
 * Gabarit HTML du relevé de notes (A4). Toutes les valeurs sont échappées.
 * Aperçu : npm run preview:transcript -w backend → docs/apercu-releve.html / .pdf
 */
export function renderTranscript(d: TranscriptData): string {
  const i = d.institute;
  const contact = [i.address, [i.city, i.country].filter(Boolean).join(', '), i.phone, i.email, i.website].filter(Boolean).map(esc).join(' · ');
  const signatory = d.school.directorName ?? i.directorName;
  const hasTp = d.semesters.some((s) => s.units.some((u) => u.tpScore !== null));

  const semesterTables = d.semesters
    .map(
      (s) => `
    <section class="semester">
      <h3>Semestre ${s.number}</h3>
      <table class="grades">
        <colgroup>
          <col style="width:9%"/><col/><col style="width:7%"/><col style="width:6%"/><col style="width:7.5%"/><col style="width:8.5%"/>${hasTp ? '<col style="width:7.5%"/>' : ''}
          <col style="width:8%"/><col style="width:8.5%"/><col style="width:7.5%"/>
        </colgroup>
        <thead>
          <tr>
            <th class="l">Code</th><th class="l">Unité d'enseignement</th>
            <th>Crédits</th><th>Coef.</th><th>CC</th><th>Examen</th>${hasTp ? '<th>TP</th>' : ''}
            <th>Note /20</th><th>Résultat</th><th>Crédits<br/>acquis</th>
          </tr>
        </thead>
        <tbody>
          ${s.units
            .map(
              (u) => `
          <tr>
            <td class="l mono">${esc(u.code)}</td>
            <td class="l">${esc(u.title)}</td>
            <td>${u.credits}</td>
            <td>${esc(u.coefficient.toLocaleString('fr-FR'))}</td>
            <td>${score(u.ccScore)}</td>
            <td>${score(u.examScore, u.isAbsent)}${u.session === 'RATTRAPAGE' ? '<sup>R</sup>' : ''}</td>
            ${hasTp ? `<td>${score(u.tpScore)}</td>` : ''}
            <td class="final ${u.final !== null && u.final < GRADING_RULES.passMark ? 'low' : ''}">${score(u.final)}</td>
            <td><span class="st st-${u.status}">${STATUS_SHORT[u.status]}</span></td>
            <td>${u.creditsEarned}</td>
          </tr>`,
            )
            .join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" class="l">Moyenne du semestre ${s.number}</td>
            <td>${s.totalCredits}</td><td></td><td></td><td></td>${hasTp ? '<td></td>' : ''}
            <td class="final">${score(s.average)}</td><td></td><td>${s.creditsEarned}</td>
          </tr>
        </tfoot>
      </table>
    </section>`,
    )
    .join('');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Relevé de notes — ${esc(d.student.lastName)} ${esc(d.student.firstName)} — ${esc(d.academicYear)}</title>
<style>
  ${BASE_CSS}
  .identity { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 24px; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 12px; background: #f8fafc; }
  .identity div { display: flex; gap: 6px; }
  .identity span { color: #6b7280; min-width: 92px; }
  .identity b { font-weight: 600; }
  .semester { margin-top: 12px; page-break-inside: avoid; }
  .semester h3 { margin: 0 0 4px; font-size: 10pt; color: #1e4fa3; text-transform: uppercase; letter-spacing: .5px; }
  table.grades { table-layout: fixed; }
  table.grades th, table.grades td { border: 1px solid #d1d5db; padding: 3.5px 4px; text-align: center; }
  table.grades thead th { background: #1e4fa3; color: #fff; font-weight: 600; font-size: 8pt; }
  table.grades tbody tr:nth-child(even) td { background: #f8fafc; }
  table.grades tfoot td { background: #e8eefb; font-weight: 700; }
  .l { text-align: left !important; }
  .mono { font-family: "DejaVu Sans Mono", monospace; font-size: 8pt; }
  .final { font-weight: 700; }
  .low { color: #b91c1c; }
  sup { color: #1e4fa3; font-weight: 700; font-size: 6.5pt; }
  .st { display: inline-block; min-width: 24px; padding: 1px 4px; border-radius: 3px; font-weight: 700; font-size: 7.5pt; }
  .st-V { background: #dcfce7; color: #166534; } .st-VC { background: #e0e7ff; color: #3730a3; }
  .st-NV { background: #fee2e2; color: #991b1b; } .st-INC { color: #6b7280; }
  .summary { margin-top: 14px; display: grid; grid-template-columns: repeat(4, 1fr); border: 2px solid #1e4fa3; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
  .summary div { padding: 8px; text-align: center; border-right: 1px solid #c7d2fe; }
  .summary div:last-child { border-right: none; }
  .summary span { display: block; font-size: 7.5pt; color: #6b7280; text-transform: uppercase; }
  .summary b { font-size: 12pt; }
  .decision-ADMIS b, .decision-ADMIS_AVEC_DETTES b { color: #166534; } .decision-AJOURNE b { color: #b91c1c; }
  .sign { margin-top: 18px; display: flex; justify-content: space-between; page-break-inside: avoid; }
  .sign .box { width: 46%; text-align: center; }
  .sign .line { margin-top: 46px; border-top: 1px solid #9ca3af; padding-top: 3px; font-size: 8pt; color: #4b5563; }
</style>
</head>
<body>
  ${d.isProvisional ? '<div class="watermark">PROVISOIRE</div>' : ''}
  <header class="header">
    <div class="brand">${SCOLARIX_LOGO}<span>Scolarix</span></div>
    <div class="inst">
      <h1>${esc(i.name)}${i.acronym ? ` (${esc(i.acronym)})` : ''}</h1>
      <div class="school">${esc(d.school.name)}</div>
      <div class="contact">${contact}</div>
    </div>
    <div class="ref">
      ${d.reference ? `Réf. <strong>${esc(d.reference)}</strong>` : ''}
      ${d.verificationCode ? `Code de vérification <strong>${esc(d.verificationCode)}</strong>` : ''}
    </div>
  </header>

  <div class="title">
    <h2>RELEVÉ DE NOTES</h2>
    <p>Année académique ${esc(d.academicYear)}${d.isProvisional ? ' — <b style="color:#b91c1c">document provisoire (avant délibération)</b>' : ''}</p>
  </div>

  <section class="identity">
    <div><span>Nom et prénom</span><b>${esc(d.student.lastName.toUpperCase())} ${esc(d.student.firstName)}</b></div>
    <div><span>Matricule</span><b class="mono">${esc(d.student.matricule)}</b></div>
    <div><span>Né${d.student.gender === 'F' ? 'e' : ''} le</span><b>${esc(frDate(d.student.birthDate))} à ${esc(d.student.birthPlace)}</b></div>
    <div><span>Niveau</span><b>${esc(d.level.name)} (${esc(d.level.code)})</b></div>
    <div><span>Spécialité</span><b>${d.specialty ? esc(d.specialty.name) : 'Tronc commun'}</b></div>
    <div><span>Diplôme préparé</span><b>${esc(d.specialty?.diplomaTitle ?? '—')}</b></div>
  </section>

  ${semesterTables || '<p>Aucune unité d’enseignement.</p>'}

  <section class="summary decision-${d.year.decision}">
    <div><span>Moyenne annuelle</span><b>${score(d.year.average)} / 20</b></div>
    <div><span>Crédits acquis</span><b>${d.year.creditsEarned} / ${d.year.totalCredits}</b></div>
    <div><span>Mention</span><b>${esc(d.year.mention ?? '—')}</b></div>
    <div><span>Décision</span><b>${esc(DECISION_LABELS[d.year.decision])}</b></div>
  </section>

  <p class="footer-note">
    V : UE validée (note ≥ ${GRADING_RULES.passMark}) · VC : validée par compensation (moyenne du semestre ≥ ${GRADING_RULES.passMark} et note ≥ ${GRADING_RULES.eliminatoryMark})
    · NV : non validée · <sup>R</sup> : note de rattrapage retenue · ABS : absent.
    Moyennes pondérées par les coefficients.
    ${d.deliberatedAt ? `Résultats arrêtés en délibération le ${esc(frDate(d.deliberatedAt))}.` : ''}
  </p>

  <div class="sign">
    <div class="box"></div>
    <div class="box">
      Fait à ${esc(i.city ?? '……………')}, le ${esc(frDate(d.issuedAt))}<br/>
      <b>${d.school.directorName ? "Le Directeur / La Directrice de l'école" : "Le Directeur / La Directrice"}</b>
      <div class="line">${esc(signatory ?? '')}</div>
    </div>
  </div>
</body>
</html>`;
}
