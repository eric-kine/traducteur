import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BookMarked, Building2, ChevronRight, FileBadge, GraduationCap, Info, Layers, UserSquare2, Users } from 'lucide-react';
import type { DashboardDto } from '@scolarix/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

function Kpi({ icon: Icon, label, value, sub, to }: { icon: typeof Users; label: string; value: number; sub?: string; to?: string }) {
  const body = (
    <Card className={cn('flex items-center gap-4 p-4', to && 'transition hover:border-primary/50 hover:shadow-md')}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums">{value.toLocaleString('fr-FR')}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

/** Tableau de bord ADMIN / SCOLARITÉ : indicateurs, alertes, répartition par école et par niveau. */
export function AdminDashboard() {
  const { data: d, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api<{ dashboard: DashboardDto }>('/dashboard').then((r) => r.dashboard) });
  if (isLoading || !d) return <p className="text-muted-foreground">Chargement du tableau de bord…</p>;
  const maxLevel = Math.max(1, ...d.byLevel.map((l) => l.enrollments));
  const warnings = d.alerts.filter((a) => a.severity === 'warning').length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {d.academicYear ? <>Année courante <b>{d.academicYear.label}</b></> : 'Aucune année courante'}{d.scope && <> · périmètre : école <b>{d.scope}</b></>}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={GraduationCap} label="Étudiants actifs" value={d.kpis.students} sub={`${d.kpis.enrollments} inscrits cette année`} to="/students" />
        <Kpi icon={UserSquare2} label="Enseignants actifs" value={d.kpis.teachers} to="/teachers" />
        <Kpi icon={BookMarked} label="Unités d'enseignement" value={d.kpis.teachingUnits} sub={`${d.kpis.levels} niveau(x)`} />
        <Kpi icon={Building2} label="Écoles" value={d.kpis.schools} to="/admin?tab=schools" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi icon={FileBadge} label="Certificats émis (30 j)" value={d.kpis.certificates30d} to="/certificates" />
        <Kpi icon={Layers} label="Relevés émis (30 j)" value={d.kpis.transcripts30d} />
        <Kpi icon={Users} label="Comptes actifs" value={d.kpis.users} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              Alertes <span className="text-sm font-normal text-muted-foreground">({d.alerts.length}{warnings ? `, dont ${warnings} importante(s)` : ''})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!d.alerts.length && <p className="text-sm text-emerald-700">✔ Rien à signaler.</p>}
            {d.alerts.map((a) => (
              <div key={a.key} className={cn('rounded-md border p-3', a.severity === 'warning' ? 'border-amber-300 bg-amber-50' : 'bg-muted/30')}>
                <div className="flex items-start justify-between gap-3">
                  <p className="flex items-center gap-2 font-medium">
                    {a.severity === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <Info className="h-4 w-4 text-primary" />}
                    {a.title} <span className="rounded-full bg-background px-2 text-xs">{a.count}</span>
                  </p>
                  {a.link && <Link to={a.link} className="flex shrink-0 items-center text-sm text-primary hover:underline">Voir <ChevronRight className="h-4 w-4" /></Link>}
                </div>
                {!!a.items.length && <ul className="mt-1 list-disc pl-10 text-sm text-muted-foreground">{a.items.map((i) => <li key={i}>{i}</li>)}</ul>}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-lg">Par école</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {d.bySchool.map((s) => (
                <div key={s.code} className="flex items-center justify-between rounded-md border p-2">
                  <span><b className="font-mono">{s.code}</b> <span className="text-muted-foreground">{s.name}</span></span>
                  <span className="text-right text-xs text-muted-foreground">{s.enrollments} inscrits · {s.levels} niv. · {s.teachingUnits} UE</span>
                </div>
              ))}
            </CardContent>
          </Card>
          {!!d.byLevel.length && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-lg">Inscrits par niveau</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {d.byLevel.map((l) => (
                  <div key={l.school + l.level} className="grid grid-cols-[72px_1fr_32px] items-center gap-2 text-sm">
                    <span className="font-mono text-xs">{l.school} {l.level}</span>
                    <div className="h-3 rounded bg-muted" aria-hidden><div className="h-3 rounded bg-primary" style={{ width: `${(l.enrollments / maxLevel) * 100}%` }} /></div>
                    <span className="text-right tabular-nums">{l.enrollments}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
