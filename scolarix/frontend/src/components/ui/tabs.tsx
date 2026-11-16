import { cn } from '@/lib/utils';

/** Onglets simples (contrôlés par le parent). */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count?: number }[];
}) {
  return (
    <div role="tablist" className="inline-flex rounded-lg bg-muted p-1">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            value === it.value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {it.label}
          {it.count !== undefined && <span className="ml-2 text-xs text-muted-foreground">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}
