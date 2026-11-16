import { useState } from 'react';
import { Lock } from 'lucide-react';
import { WEEKDAY_LABELS, type SessionView, type TimetableView, type Weekday } from '@scolarix/shared';
import { cn } from '@/lib/utils';

const TYPE_STYLE = {
  CM: 'border-l-blue-700 bg-blue-50 text-blue-950',
  TD: 'border-l-emerald-700 bg-emerald-50 text-emerald-950',
  TP: 'border-l-amber-700 bg-amber-50 text-amber-950',
} as const;

interface Props {
  view: TimetableView;
  editable?: boolean;
  /** Glisser-déposer : séance déposée sur une autre case */
  onMove?: (session: SessionView, day: Weekday, timeslotId: string) => void;
  onSelect?: (session: SessionView) => void;
}

/**
 * Calendrier hebdomadaire interactif : jours en colonnes, créneaux en lignes.
 * En mode édition, une séance se déplace par glisser-déposer (le serveur refuse
 * les conflits) ou s'ouvre d'un clic.
 */
export function TimetableGrid({ view, editable, onMove, onSelect }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const card = (s: SessionView) => {
    const line2 = view.kind === 'teacher' ? `${s.level.code} · ${s.school.code}` : s.teacher?.name ?? 'Enseignant à désigner';
    const line3 = view.kind === 'room' ? `${s.level.code} · ${s.school.code}` : s.room ? `Salle ${s.room.code}` : 'Sans salle';
    return (
      <button
        key={s.id}
        type="button"
        draggable={editable}
        onDragStart={(e) => { setDragId(s.id); e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; }}
        onDragEnd={() => { setDragId(null); setOver(null); }}
        onClick={() => onSelect?.(s)}
        aria-label={`${s.teachingUnit.code} ${s.sessionType}, ${WEEKDAY_LABELS[s.day]}`}
        className={cn(
          'mb-1 w-full rounded-md border-l-4 px-2 py-1 text-left text-xs shadow-sm transition',
          TYPE_STYLE[s.sessionType],
          editable && 'cursor-grab hover:shadow-md active:cursor-grabbing',
          dragId === s.id && 'opacity-40',
        )}
      >
        <div className="flex items-center justify-between gap-1 font-semibold">
          <span className="truncate">{s.teachingUnit.code}</span>
          <span className="flex shrink-0 items-center gap-1">
            {s.locked && <Lock className="h-3 w-3" aria-label="épinglée" />}
            {s.sessionType}{view.kind === 'level' && s.audience && ` · ${s.audience.code}`}
          </span>
        </div>
        <div className="truncate opacity-80">{s.teachingUnit.title}</div>
        <div className="truncate opacity-70">{line2}</div>
        <div className="truncate opacity-70">{line3}</div>
      </button>
    );
  };

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-20 border-b bg-muted/50 p-2" />
            {view.days.map((d) => <th key={d} className="border-b border-l bg-muted/50 p-2 font-semibold">{WEEKDAY_LABELS[d]}</th>)}
          </tr>
        </thead>
        <tbody>
          {view.slots.map((slot, i) => {
            const prev = view.slots[i - 1];
            return [
              prev && prev.endTime < slot.startTime && (
                <tr key={`p${slot.id}`}><td colSpan={view.days.length + 1} className="border-b bg-muted/40 py-1 text-center text-xs text-muted-foreground">Pause {prev.endTime} – {slot.startTime}</td></tr>
              ),
              <tr key={slot.id}>
                <td className="border-b bg-muted/20 p-2 text-center text-xs font-semibold text-muted-foreground">{slot.startTime}<br />{slot.endTime}</td>
                {view.days.map((d) => {
                  const k = `${d}|${slot.id}`;
                  const items = view.sessions.filter((s) => s.day === d && s.timeslotId === slot.id);
                  return (
                    <td
                      key={k}
                      data-cell={k}
                      className={cn('h-28 border-b border-l p-1 align-top', over === k && 'bg-primary/10 ring-2 ring-inset ring-primary')}
                      onDragOver={editable ? (e) => { e.preventDefault(); setOver(k); } : undefined}
                      onDragLeave={editable ? () => setOver((o) => (o === k ? null : o)) : undefined}
                      onDrop={editable ? (e) => {
                        e.preventDefault();
                        setOver(null);
                        const s = view.sessions.find((x) => x.id === e.dataTransfer.getData('text/plain'));
                        if (s && (s.day !== d || s.timeslotId !== slot.id)) onMove?.(s, d, slot.id);
                      } : undefined}
                    >
                      {items.map(card)}
                    </td>
                  );
                })}
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
