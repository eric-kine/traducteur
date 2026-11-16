import { evaluationSummary, formatHours, type SyllabusDto } from '@scolarix/shared';
import { BASE_CSS, esc, frDate, SCOLARIX_LOGO } from './common';

/**
 * Texte libre → HTML : paragraphes ; les lignes commençant par "-", "•" ou "*"
 * deviennent une liste à puces. Tout est échappé.
 */
export function richText(t: string | null | undefined): string {
  if (!t?.trim()) return '<p class="empty">Non renseigné.</p>';
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`); list = []; } };
  for (const raw of t.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const m = line.match(/^[-•*]\s*(.+)$/);
    if (m) list.push(m[1]!);
    else { flush(); out.push(`<p>${esc(line)}</p>`); }
  }
  flush();
  return out.join('');
}

/** Bibliographie : une référence par ligne → liste numérotée. */
const bibliography = (t: string | null) => {
  const refs = (t ?? '').split(/\r?\n/).map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);
  return refs.length ? `<ol class="biblio">${refs.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>` : '<p class="empty">Non renseignée.</p>';
};

const TYPE_LABEL = { CM: 'Cours magistral', TD: 'Travaux dirigés', TP: 'Travaux pratiques' } as const;

/** Gabarit HTML A4 du syllabus d'une UE. */
export function renderSyllabus(d: SyllabusDto, generatedAt = new Date().toISOString()): string {
  const u = d.teachingUnit;
  const f = d.fields;
  const i = d.institute;
  const objectives = f.objectives ?? u.objectives;
  const prerequisites = f.prerequisites ?? u.prerequisites;
  const biblio = f.bibliography ?? u.bibliography;
  const coordinator = d.teachers.find((t) => t.isCoordinator);
  const others = d.teachers.filter((t) => !t.isCoordinator);
  const name = (t: SyllabusDto['teachers'][number]) => `${t.title ? `${esc(t.title)} ` : ''}${esc(t.firstName)} ${esc(t.lastName.toUpperCase())}`;
  const plannedHours = f.content.reduce((a, c) => a + (c.hours ?? 0), 0);

  const volumes = [
    ['CM', u.cmHours], ['TD', u.tdHours], ['TP', u.tpHours],
  ].filter(([, h]) => (h as number) > 0).map(([t, h]) => `${t} ${formatHours(h as number)}`).join(' · ');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Syllabus ${esc(u.code)} — ${esc(u.title)} — ${esc(d.academicYear.label)}</title>
<style>
  ${BASE_CSS}
  @page { margin: 14mm 12mm 18mm; }
  body { font-size: 9.5pt; line-height: 1.45; }
  .ue-title { margin: 14px 0 10px; padding: 10px 14px; background: #1e4fa3; color: #fff; border-radius: 6px; }
  .ue-title .code { font-family: "DejaVu Sans Mono", monospace; font-size: 10pt; opacity: .9; }
  .ue-title h2 { margin: 2px 0 0; font-size: 15pt; }
  table.facts { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  table.facts td { border: 1px solid #d1d5db; padding: 5px 8px; vertical-align: top; }
  table.facts td.k { width: 22%; background: #f1f5fb; color: #374151; font-weight: 600; }
  .vol { display: flex; gap: 6px; flex-wrap: wrap; }
  .vol span { background: #e8eefb; border-radius: 4px; padding: 1px 6px; font-weight: 600; }
  section { margin-top: 12px; page-break-inside: avoid; }
  section.long { page-break-inside: auto; }
  h3 { margin: 0 0 4px; font-size: 10.5pt; color: #1e4fa3; text-transform: uppercase; letter-spacing: .4px; border-bottom: 1px solid #c7d2fe; padding-bottom: 2px; }
  p { margin: 0 0 4px; }
  ul { margin: 2px 0 4px 18px; padding: 0; }
  .empty { color: #9ca3af; font-style: italic; }
  table.plan { width: 100%; border-collapse: collapse; }
  table.plan th, table.plan td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; vertical-align: top; }
  table.plan thead th { background: #1e4fa3; color: #fff; font-size: 8.5pt; }
  table.plan td.c { text-align: center; white-space: nowrap; }
  table.plan tfoot td { background: #e8eefb; font-weight: 700; }
  .desc { color: #4b5563; font-size: 8.5pt; }
  .biblio { margin: 2px 0 0 18px; padding: 0; }
  .teachers td { border: none; padding: 1px 0; }
  .status { float: right; font-size: 8pt; color: #b91c1c; border: 1px solid #b91c1c; padding: 0 6px; border-radius: 3px; }
</style>
</head>
<body>
  <header class="header">
    <div class="brand">${SCOLARIX_LOGO}<span>Scolarix</span></div>
    <div class="inst">
      <h1>${esc(i.name)}${i.acronym ? ` (${esc(i.acronym)})` : ''}</h1>
      <div class="school">${esc(d.school.name)}</div>
      <div class="contact">${esc(d.level.name)} (${esc(d.level.code)})${d.specialty ? ` · Spécialité ${esc(d.specialty.name)}` : ' · Tronc commun'} · Semestre ${u.semester}</div>
    </div>
    <div class="ref">Année académique<strong>${esc(d.academicYear.label)}</strong></div>
  </header>

  <div class="ue-title">
    ${d.status !== 'PUBLIE' ? '<span class="status" style="color:#fff;border-color:#fff">BROUILLON</span>' : ''}
    <div class="code">SYLLABUS · ${esc(u.code)}</div>
    <h2>${esc(u.title)}</h2>
  </div>

  <table class="facts">
    <tr><td class="k">Code</td><td>${esc(u.code)}</td><td class="k">Crédits ECTS</td><td>${u.credits}</td></tr>
    <tr><td class="k">Niveau</td><td>${esc(d.level.name)}</td><td class="k">Coefficient</td><td>${esc(u.coefficient.toLocaleString('fr-FR'))}</td></tr>
    <tr><td class="k">Semestre</td><td>${u.semester}</td><td class="k">Volume horaire</td><td><div class="vol">${volumes ? volumes.split(' · ').map((v) => `<span>${esc(v)}</span>`).join('') : '—'}<b>= ${esc(formatHours(u.totalHours))}</b></div></td></tr>
    <tr>
      <td class="k">Responsable</td>
      <td colspan="3">${coordinator ? `${name(coordinator)}${coordinator.grade ? ` — ${esc(coordinator.grade)}` : ''} · ${esc(coordinator.email)}` : '<span class="empty">Non désigné</span>'}</td>
    </tr>
    ${others.length ? `<tr><td class="k">Intervenants</td><td colspan="3"><table class="teachers">${others.map((t) => `<tr><td>${name(t)} (${t.sessionTypes.join(', ')}) · ${esc(t.email)}</td></tr>`).join('')}</table></td></tr>` : ''}
  </table>

  ${u.description ? `<section><h3>Présentation</h3>${richText(u.description)}</section>` : ''}
  <section><h3>Objectifs pédagogiques</h3>${richText(objectives)}</section>
  ${f.competencies ? `<section><h3>Compétences visées</h3>${richText(f.competencies)}</section>` : ''}
  <section><h3>Prérequis</h3>${richText(prerequisites)}</section>

  <section class="long">
    <h3>Contenu détaillé</h3>
    ${f.content.length ? `
    <table class="plan">
      <thead><tr><th style="width:5%">#</th><th>Chapitre / séquence</th><th style="width:16%">Type</th><th style="width:10%">Heures</th></tr></thead>
      <tbody>
        ${f.content.map((c, n) => `
        <tr>
          <td class="c">${n + 1}</td>
          <td><b>${esc(c.title)}</b>${c.description ? `<div class="desc">${esc(c.description)}</div>` : ''}</td>
          <td>${c.sessionType ? TYPE_LABEL[c.sessionType] : '—'}</td>
          <td class="c">${c.hours !== null ? esc(formatHours(c.hours)) : '—'}</td>
        </tr>`).join('')}
      </tbody>
      ${plannedHours ? `<tfoot><tr><td></td><td colspan="2">Total des séquences (volume de l'UE : ${esc(formatHours(u.totalHours))})</td><td class="c">${esc(formatHours(plannedHours))}</td></tr></tfoot>` : ''}
    </table>` : '<p class="empty">Non renseigné.</p>'}
  </section>

  <section><h3>Méthodes pédagogiques</h3>${richText(f.teachingMethods)}</section>

  <section>
    <h3>Modalités d'évaluation</h3>
    <ul>${evaluationSummary(u).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    ${f.evaluationMethods ? richText(f.evaluationMethods) : ''}
  </section>

  <section><h3>Bibliographie</h3>${bibliography(biblio)}</section>

  <p class="footer-note" style="margin-top:14px">Document généré le ${esc(frDate(generatedAt))} par Scolarix${d.updatedAt ? ` · contenu mis à jour le ${esc(frDate(d.updatedAt))}` : ''}.</p>
</body>
</html>`;
}
