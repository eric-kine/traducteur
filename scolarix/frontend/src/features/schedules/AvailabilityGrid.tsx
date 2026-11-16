import { WEEKDAY_LABELS, WEEKDAYS, type TimeslotDto, type Unavailability } from '@scolarix/shared';
import { cn } from '@/lib/utils';

/** Grille jours × créneaux : un clic bascule disponible (vert) / indisponible (gris barré). */
export function AvailabilityGrid({
  slots, value, onChange, disabled,
}: { slots: TimeslotDto[]; value: Unavailability; onChange: (v: Unavailability) => void; disabled?: boolean }) {
  const off = new Set(value.map((u) => `${u.day}@${u.start}`));
  const toggle = (day: (typeof WEEKDAYS)[number], start: string) => {
    const k = `${day}@${start}`;
    onChange(off.has(k) ? value.filter((u) => `${u.day}@${u.start}` !== k) : [...value, { day, start }]);
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-xs">
        <thead>
          <tr><th className="p-1" />{WEEKDAYS.map((d) => <th key={d} className="p-1 font-medium">{WEEKDAY_LABELS[d].slice(0, 3)}</th>)}</tr>
        </thead>
        <tbody>
          {slots.map((s) => (
            <tr key={s.id}>
              <td className="whitespace-nowrap p-1 text-muted-foreground">{s.startTime}–{s.endTime}</td>
              {WEEKDAYS.map((d) => {
                const unavailable = off.has(`${d}@${s.startTime}`);
                return (
                  <td key={d} className="p-0.5">
                    <button type="button" disabled={disabled} onClick={() => toggle(d, s.startTime)}
                      aria-pressed={!unavailable} aria-label={`${WEEKDAY_LABELS[d]} ${s.startTime} : ${unavailable ? 'indisponible' : 'disponible'}`}
                      className={cn('h-8 w-full rounded border text-[10px] font-medium transition',
                        unavailable ? 'border-muted bg-muted text-muted-foreground line-through' : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100')}>
                      {unavailable ? 'Indispo' : 'Dispo'}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
