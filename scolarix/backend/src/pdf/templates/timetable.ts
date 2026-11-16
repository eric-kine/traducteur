import { WEEKDAY_LABELS, type TimetableView } from '@scolarix/shared';
import { BASE_CSS, esc, SCOLARIX_LOGO } from './common';

const COLORS = { CM: ['#dbe6fb', '#1e4fa3'], TD: ['#dcfce7', '#166534'], TP: ['#fef3c7', '#92400e'] } as const;

/**
 * Grille hebdomadaire (A4 paysage) : jours en colonnes, créneaux en lignes,
 * une ligne « Pause » quand deux créneaux ne se suivent pas (ex. 12:00 → 14:00).
 */
export function renderTimetable(v: TimetableView, institute: { name: string; acronym: string | null }): string {
  const cell = (day: string, slotId: string) =>
    v.sessions
      .filter((s) => s.day === day && s.timeslotId === slotId)
      .map((s) => {
        const [bg, fg] = COLORS[s.sessionType];
        const who = v.kind === 'teacher' ? `${esc(s.level.code)} · ${esc(s.school.code)}` : s.teacher ? esc(s.teacher.name) : '<i>enseignant à désigner</i>';
        const where = v.kind === 'room' ? `${esc(s.level.code)} · ${esc(s.school.code)}` : s.room ? `Salle ${esc(s.room.code)}` : '<i>sans salle</i>';
        const aud = v.kind === 'level' ? (s.audience ? ` · ${esc(s.audience.code)}` : '') : '';
        return `<div class="s" style="background:${bg};border-left-color:${fg}">
          <div class="h"><b>${esc(s.teachingUnit.code)}</b><span style="color:${fg}">${s.sessionType}${aud}</span></div>
          <div class="t">${esc(s.teachingUnit.title)}</div>
          <div class="m">${who}<br/>${where}</div>
        </div>`;
      })
      .join('');

  const rows: string[] = [];
  v.slots.forEach((slot, i) => {
    const prev = v.slots[i - 1];
    if (prev && prev.endTime < slot.startTime) rows.push(`<tr class="pause"><td>${prev.endTime}<br/>${slot.startTime}</td><td colspan="${v.days.length}">Pause</td></tr>`);
    rows.push(`<tr><td class="time">${slot.startTime}<br/>${slot.endTime}</td>${v.days.map((d) => `<td>${cell(d, slot.id)}</td>`).join('')}</tr>`);
  });

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><title>Emploi du temps — ${esc(v.title)}</title>
<style>
  ${BASE_CSS}
  @page { size: A4 landscape; margin: 9mm 9mm 12mm; }
  body { font-size: 8pt; }
  .header { padding-bottom: 5px; }
  .inst h1 { font-size: 11pt; }
  table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 8px; }
  table.grid th { background: #1e4fa3; color: #fff; padding: 4px; font-size: 8.5pt; }
  table.grid th.time, table.grid td.time { width: 52px; }
  table.grid td { border: 1px solid #d1d5db; vertical-align: top; padding: 2px; height: 74px; }
  table.grid td.time { text-align: center; vertical-align: middle; font-weight: 700; color: #374151; background: #f8fafc; }
  tr.pause td { height: auto; background: #f3f4f6; text-align: center; color: #6b7280; font-size: 7pt; padding: 1px; }
  .s { border-left: 3px solid; border-radius: 3px; padding: 2px 4px; margin-bottom: 2px; }
  .s .h { display: flex; justify-content: space-between; font-size: 8pt; }
  .s .t { font-size: 7pt; line-height: 1.15; max-height: 2.3em; overflow: hidden; }
  .s .m { font-size: 6.8pt; color: #374151; margin-top: 1px; }
  .legend { margin-top: 5px; font-size: 7pt; color: #4b5563; display: flex; gap: 12px; }
  .legend span::before { content: ''; display: inline-block; width: 9px; height: 9px; margin-right: 3px; vertical-align: -1px; border-radius: 2px; background: var(--c); }
</style></head>
<body>
  <header class="header">
    <div class="brand">${SCOLARIX_LOGO}<span>Scolarix</span></div>
    <div class="inst">
      <h1>${esc(institute.name)}${institute.acronym ? ` (${esc(institute.acronym)})` : ''}</h1>
      <div class="school">Emploi du temps — ${esc(v.title)}</div>
      <div class="contact">${esc(v.subtitle)}</div>
    </div>
    <div class="ref">${v.schedule && v.schedule.status !== 'PUBLIE' ? '<strong style="color:#b91c1c">BROUILLON</strong>' : ''}</div>
  </header>
  <table class="grid">
    <thead><tr><th class="time"></th>${v.days.map((d) => `<th>${WEEKDAY_LABELS[d]}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>
  <div class="legend">
    <span style="--c:${COLORS.CM[0]}">CM : cours magistral</span><span style="--c:${COLORS.TD[0]}">TD : travaux dirigés</span><span style="--c:${COLORS.TP[0]}">TP : travaux pratiques</span>
    <span style="margin-left:auto">${v.sessions.length} séance(s) hebdomadaire(s)</span>
  </div>
</body></html>`;
}
