import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarRange, CheckCircle2, FileDown, Send, Sparkles, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import type { SessionView } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuth } from '@/stores/auth.store';
import { useAcademicYears, useCurrentYear } from '../academic-years/academic-years.api';
import { useSchools } from '../schools/schools.api';
import { useLevels } from '../levels/levels.api';
import { useTeachers } from '../teachers/teachers.api';
import { openResourcePdf, openSchedulePdf, useGenerate, useLevelTimetable, useMoveSession, useResourceTimetable, useRooms, useSetStatus } from './schedules.api';
import { TimetableGrid } from './TimetableGrid';
import { SessionDialog } from './SessionDialog';

type Mode = 'level' | 'teacher' | 'room';

function LevelView({ yearId, semester }: { yearId: string; semester: number }) {
  const user = useAuth((s) => s.user);
  const [params, setParams] = useSearchParams();
  const { data: schools = [] } = useSchools({ isActive: 'true' });
  const schoolId = params.get('school') ?? user?.schoolId ?? schools[0]?.id ?? '';
  const { data: levels = [] } = useLevels(schoolId);
  const levelId = params.get('level') ?? levels[0]?.id ?? '';
  const { data: view, isLoading } = useLevelTimetable(levelId, yearId, semester);
  const generate = useGenerate();
  const move = useMoveSession();
  const setStatus = useSetStatus();
  const [weeks, setWeeks] = useState(14);
  const [confirm, setConfirm] = useState(false);
  const [selected, setSelected] = useState<SessionView | null>(null);
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); p.set(k, v); if (k === 'school') p.delete('level'); setParams(p); };
  useEffect(() => { if (view?.schedule) setWeeks(view.schedule.weeks); }, [view?.schedule]);

  const run = async () => {
    try {
      const r = await generate.mutateAsync({ levelId, academicYearId: yearId, semester, weeks });
      const rep = r.timetable.schedule!.report!;
      if (rep.unplaced.length) toast.warning(`${rep.placed}/${rep.total} séances placées — voir le rapport`);
      else toast.success(`Emploi du temps généré : ${rep.placed} séances placées sans conflit`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur'); }
  };
  const onMove = (s: SessionView, day: SessionView['day'], timeslotId: string) =>
    move.mutate({ id: s.id, day, timeslotId }, { onSuccess: () => toast.success('Séance déplacée et épinglée'), onError: (e) => toast.error(e.message) });

  const sched = view?.schedule;
  const report = sched?.report;
  const editable = !!sched?.canEdit;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="space-y-1 text-sm">École
          <NativeSelect value={schoolId} onChange={(e) => set('school', e.target.value)} disabled={!!user?.schoolId}>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm">Niveau
          <NativeSelect value={levelId} onChange={(e) => set('level', e.target.value)}>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
          </NativeSelect>
        </label>
        <label className="w-28 space-y-1 text-sm" title="Semaines d'enseignement dans le semestre">Semaines
          <Input type="number" min={1} max={30} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} />
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={() => (sched ? setConfirm(true) : run())} disabled={!levelId || !yearId || generate.isPending}>
            <Sparkles /> {generate.isPending ? 'Génération…' : sched ? 'Régénérer' : 'Générer automatiquement'}
          </Button>
          {sched && editable && (sched.status === 'PUBLIE'
            ? <Button variant="outline" onClick={() => setStatus.mutate({ id: sched.id, status: 'BROUILLON' })}><Undo2 /> Repasser en brouillon</Button>
            : <Button variant="outline" onClick={() => setStatus.mutate({ id: sched.id, status: 'PUBLIE' }, { onSuccess: () => toast.success('Emploi du temps publié') })}><Send /> Publier</Button>)}
          {sched && <Button variant="outline" onClick={() => openSchedulePdf(sched.id)}><FileDown /> PDF</Button>}
        </div>
      </Card>

      {report && (
        <Card className="space-y-3 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {report.unplaced.length ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            <b>{report.placed}/{report.total} séances placées</b>
            <Badge variant={sched!.status === 'PUBLIE' ? 'success' : 'secondary'}>{sched!.status === 'PUBLIE' ? 'Publié' : 'Brouillon'}</Badge>
            <span className="text-muted-foreground">· algorithme : {report.strategy === 'backtracking' ? 'retour arrière (solution complète)' : 'glouton (placement partiel)'} · {report.steps} essais · {sched!.weeks} semaines</span>
          </div>
          {report.unplaced.map((u, i) => (
            <p key={i} className="text-amber-800">⚠ {u.teachingUnit} {u.sessionType}{u.audience ? ` · ${u.audience}` : ''}{u.teacher ? ` (${u.teacher})` : ''} non placée : {u.reason}</p>
          ))}
          {report.warnings.map((w, i) => <p key={i} className="text-muted-foreground">ℹ {w}</p>)}
          <details>
            <summary className="cursor-pointer text-muted-foreground">Volumes horaires → séances hebdomadaires</summary>
            <Table className="mt-2">
              <TableHeader><TableRow><TableHead>UE</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Volume UE</TableHead><TableHead className="text-right">Séances / sem.</TableHead><TableHead className="text-right">Heures prévues</TableHead></TableRow></TableHeader>
              <TableBody>
                {report.coverage.map((c) => (
                  <TableRow key={c.teachingUnit + c.sessionType}>
                    <TableCell>{c.teachingUnit}</TableCell><TableCell>{c.sessionType}</TableCell>
                    <TableCell className="text-right">{c.quotaHours} h</TableCell><TableCell className="text-right">{c.weeklySessions}</TableCell>
                    <TableCell className="text-right">{c.plannedHours} h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
        </Card>
      )}

      {isLoading ? <p className="text-muted-foreground">Chargement…</p> : !view ? (
        <Card><EmptyState icon={CalendarRange} title="Pas encore d'emploi du temps" text="Cliquez sur « Générer automatiquement » : les séances sont calculées à partir des volumes horaires des UE et des enseignants affectés." /></Card>
      ) : (
        <>
          {editable && <p className="text-xs text-muted-foreground">Glissez une séance vers une autre case pour la déplacer (les conflits sont refusés), ou cliquez dessus pour la modifier. 🔒 = épinglée.</p>}
          <TimetableGrid view={view} editable={editable} onMove={onMove} onSelect={editable ? setSelected : undefined} />
          <SessionDialog session={selected} view={view} onClose={() => setSelected(null)} />
        </>
      )}
      <ConfirmDialog open={confirm} title="Régénérer l'emploi du temps ?" confirmLabel="Régénérer"
        description="Les séances non épinglées sont recalculées. Les séances épinglées (🔒) restent à leur place."
        onConfirm={run} onClose={() => setConfirm(false)} />
    </div>
  );
}

function ResourceView({ kind, yearId, semester }: { kind: 'teacher' | 'room'; yearId: string; semester: number }) {
  const { data: teachers = [] } = useTeachers({ isActive: 'true' });
  const { data: rooms = [] } = useRooms();
  const options = kind === 'teacher' ? teachers.map((t) => ({ id: t.id, label: `${t.lastName.toUpperCase()} ${t.firstName}` })) : rooms.map((r) => ({ id: r.id, label: `${r.code} (${r.capacity} places)` }));
  const [id, setId] = useState('');
  useEffect(() => { if (!id && options[0]) setId(options[0].id); }, [options, id]);
  const { data: view } = useResourceTimetable(kind, id, yearId, semester);
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[240px] space-y-1 text-sm">{kind === 'teacher' ? 'Enseignant' : 'Salle'}
          <NativeSelect value={id} onChange={(e) => setId(e.target.value)}>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</NativeSelect>
        </label>
        {view && <span className="text-sm text-muted-foreground">{view.sessions.length} séance(s) par semaine</span>}
        {id && <Button className="ml-auto" variant="outline" onClick={() => openResourcePdf(kind, id, yearId, semester)}><FileDown /> PDF</Button>}
      </Card>
      {view && <TimetableGrid view={view} />}
    </div>
  );
}

export function SchedulesPage() {
  const [params, setParams] = useSearchParams();
  const { data: years = [] } = useAcademicYears();
  const current = useCurrentYear();
  const yearId = params.get('year') ?? current?.id ?? '';
  const semester = Number(params.get('semester') ?? 1);
  const mode = (params.get('view') as Mode) ?? 'level';
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); p.set(k, v); setParams(p); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Emplois du temps</h1>
          <p className="text-muted-foreground">Génération automatique, ajustements par glisser-déposer, vues par niveau, enseignant et salle</p>
        </div>
        <div className="flex gap-2">
          <NativeSelect aria-label="Année" className="w-36" value={yearId} onChange={(e) => set('year', e.target.value)}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Semestre" className="w-36" value={semester} onChange={(e) => set('semester', e.target.value)}>
            <option value={1}>Semestre 1</option><option value={2}>Semestre 2</option>
          </NativeSelect>
        </div>
      </div>
      <Tabs<Mode> value={mode} onChange={(m) => set('view', m)} items={[{ value: 'level', label: 'Par niveau' }, { value: 'teacher', label: 'Par enseignant' }, { value: 'room', label: 'Par salle' }]} />
      {!yearId ? <p className="text-destructive">Créez d'abord une année académique.</p>
        : mode === 'level' ? <LevelView yearId={yearId} semester={semester} />
        : <ResourceView key={mode} kind={mode} yearId={yearId} semester={semester} />}
    </div>
  );
}
