import { Calculator } from 'lucide-react';
import {
  computeCost,
  computePaidHours,
  computeTotalHours,
  formatAmount,
  formatHours,
  PAID_HOURS_COEFFICIENTS as K,
  weightsSum,
} from '@scolarix/shared';
import { cn } from '@/lib/utils';

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

interface Props {
  cmHours?: unknown;
  tdHours?: unknown;
  tpHours?: unknown;
  paidHours?: unknown;
  paidAuto: boolean;
  hourlyRate?: unknown;
  ccWeight?: unknown;
  examWeight?: unknown;
  tpWeight?: unknown;
}

/**
 * Panneau de calcul en temps réel : se met à jour à chaque frappe, avec
 * EXACTEMENT les mêmes fonctions que le serveur (package partagé).
 */
export function HoursSummary(p: Props) {
  const hours = { cmHours: n(p.cmHours), tdHours: n(p.tdHours), tpHours: n(p.tpHours) };
  const total = computeTotalHours(hours);
  const paid = p.paidAuto ? computePaidHours(hours) : n(p.paidHours);
  const rate = p.hourlyRate === '' || p.hourlyRate === null || p.hourlyRate === undefined ? null : n(p.hourlyRate);
  const cost = computeCost(paid, rate);
  const wSum = weightsSum({ ccWeight: n(p.ccWeight), examWeight: n(p.examWeight), tpWeight: n(p.tpWeight) });

  const Row = ({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) => (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-muted-foreground">
        {label}
        {hint && <span className="block text-xs">{hint}</span>}
      </span>
      <span className={cn('tabular-nums', strong && 'text-base font-semibold text-foreground')}>{value}</span>
    </div>
  );

  return (
    <aside aria-live="polite" className="rounded-lg border bg-muted/40 p-4 text-sm">
      <p className="mb-2 flex items-center gap-2 font-semibold"><Calculator className="h-4 w-4" /> Calcul automatique</p>
      <Row label="Volume total" hint={`CM ${formatAmount(hours.cmHours)} + TD ${formatAmount(hours.tdHours)} + TP ${formatAmount(hours.tpHours)}`} value={formatHours(total)} strong />
      <Row
        label="Volume payé"
        hint={p.paidAuto ? `Équivalent TD : CM × ${formatAmount(K.cm)} + TD + TP` : 'Saisi manuellement'}
        value={formatHours(paid)}
        strong
      />
      <Row label="Coût estimé" hint={rate === null ? 'Renseignez un taux horaire' : `${formatHours(paid)} × ${formatAmount(rate)}`} value={cost === null ? '—' : formatAmount(cost)} />
      <div className="mt-2 border-t pt-2">
        <Row label="Pondérations" value={`${wSum} %`} />
        {wSum !== 100 && <p className="text-xs text-destructive">La somme doit faire 100 %.</p>}
      </div>
    </aside>
  );
}
