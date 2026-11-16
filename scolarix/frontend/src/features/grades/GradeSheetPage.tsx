import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { computeRetakeFinal, computeUeFinal, formatScore, GRADING_RULES, type GradeSheetRow } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAcademicYears, useCurrentYear } from '../academic-years/academic-years.api';
import { useAuth } from '@/stores/auth.store';
import { useGradeSheet, useSaveGradeSheet, type Session } from './grades.api';

interface Draft { cc: string; exam: string; tp: string; abs: boolean }

const toDraft = (r: GradeSheetRow): Draft => ({
  cc: r.ccScore?.toString() ?? '', exam: r.examScore?.toString() ?? '', tp: r.tpScore?.toString() ?? '', abs: r.isAbsent,
});
const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));
const invalid = (s: string) => { const v = num(s); return v !== null && (Number.isNaN(v) || v < 0 || v > 20); };

/** Saisie des notes d'une UE : une ligne par étudiant, note finale calculée en direct. */
export function GradeSheetPage() {
  const { unitId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data: years = [] } = useAcademicYears();
  const current = useCurrentYear();
  const yearId = params.get('year') ?? current?.id ?? '';
  const session = (params.get('session') === 'RATTRAPAGE' ? 'RATTRAPAGE' : 'NORMALE') as Session;
  const { data: sheet, isLoading, error } = useGradeSheet(unitId, yearId, session);
  const save = useSaveGradeSheet(unitId);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [dirty, setDirty] = useState(false);
  const isTeacher = useAuth((st) => st.user?.role === 'ENSEIGNANT');

  useEffect(() => {
    if (sheet) { setDrafts(Object.fromEntries(sheet.rows.map((r) => [r.enrollmentId, toDraft(r)]))); setDirty(false); }
  }, [sheet]);

  const u = sheet?.teachingUnit;
  const w = u ? { ccWeight: u.ccWeight, examWeight: u.examWeight, tpWeight: u.tpWeight } : null;
  const retake = session === 'RATTRAPAGE';
  const editable = !!sheet?.canEdit;

  /** Note finale en direct, avec les mêmes règles que le serveur. */
  const finalOf = (r: GradeSheetRow) => {
    const d = drafts[r.enrollmentId];
    if (!d || !w) return null;
    const s = { ccScore: num(d.cc), examScore: num(d.exam), tpScore: num(d.tp), isAbsent: d.abs };
    return retake ? computeRetakeFinal(w, r.normal ?? null, s) : computeUeFinal(w, s);
  };

  const stats = useMemo(() => {
    if (!sheet) return null;
    const finals = sheet.rows.map(finalOf).filter((f): f is number => f !== null);
    return {
      entered: finals.length,
      passed: finals.filter((f) => f >= GRADING_RULES.passMark).length,
      avg: finals.length ? finals.reduce((a, b) => a + b, 0) / finals.length : null,
    };
  }, [sheet, drafts]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (id: string, k: keyof Draft, v: string | boolean) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id]!, [k]: v } }));
    setDirty(true);
  };

  const onSave = async () => {
    if (!sheet) return;
    const rows = Object.entries(drafts);
    if (rows.some(([, d]) => invalid(d.cc) || invalid(d.exam) || invalid(d.tp))) return toast.error('Certaines notes ne sont pas entre 0 et 20');
    try {
      await save.mutateAsync({
        academicYearId: yearId, session,
        grades: rows.map(([enrollmentId, d]) => ({ enrollmentId, ccScore: retake ? null : num(d.cc), examScore: num(d.exam), tpScore: num(d.tp), isAbsent: d.abs })),
      });
      toast.success('Notes enregistrées');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  if (error instanceof ApiError && error.status === 403) return <p className="text-destructive">{error.message}</p>;

  return (
    <div className="space-y-6">
      {u && (
        <Link to={isTeacher ? '/' : `/admin/levels/${u.levelId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {isTeacher ? 'Mon espace' : 'Maquette du niveau'}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Saisie des notes</p>
          <h1 className="text-2xl font-bold">{u ? <><span className="font-mono">{u.code}</span> — {u.title}</> : '…'}</h1>
          {u && (
            <p className="text-sm text-muted-foreground">
              Semestre {u.semester} · {u.credits} crédits · coef. {u.coefficient} · Pondération : CC {u.ccWeight} % · Examen {u.examWeight} %{u.tpWeight ? ` · TP ${u.tpWeight} %` : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <NativeSelect aria-label="Année académique" className="w-40" value={yearId} onChange={(e) => setParams({ year: e.target.value, session })}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </NativeSelect>
          {editable && <Button onClick={onSave} disabled={!dirty || save.isPending}><Save /> Enregistrer</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs<Session> value={session} onChange={(s) => setParams({ year: yearId, session: s })}
          items={[{ value: 'NORMALE', label: 'Session normale' }, { value: 'RATTRAPAGE', label: 'Rattrapage' }]} />
        {stats && (
          <p className="text-sm text-muted-foreground">
            {stats.entered}/{sheet!.rows.length} notes calculées · {stats.passed} ≥ {GRADING_RULES.passMark} · moyenne de la classe {formatScore(stats.avg === null ? null : Math.round(stats.avg * 100) / 100)}
          </p>
        )}
      </div>

      {sheet?.locked && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <Lock className="h-4 w-4" /> Notes verrouillées : la délibération a eu lieu. Un administrateur peut la rouvrir depuis la page Résultats.
        </div>
      )}
      {retake && <p className="text-sm text-muted-foreground">Seuls les étudiants sans note suffisante en session normale apparaissent. Le CC est conservé ; la meilleure des deux notes est retenue.</p>}

      <Card>
        {isLoading || !sheet ? <p className="p-6 text-muted-foreground">Chargement…</p> : !sheet.rows.length ? (
          <p className="p-6 text-sm text-muted-foreground">{retake ? 'Aucun étudiant au rattrapage.' : 'Aucun étudiant inscrit à ce niveau pour cette année.'}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Étudiant</TableHead>
                {retake && <TableHead className="text-center">Session normale</TableHead>}
                {!retake && u!.ccWeight > 0 && <TableHead className="w-24 text-center">CC</TableHead>}
                {u!.examWeight > 0 && <TableHead className="w-24 text-center">Examen</TableHead>}
                {u!.tpWeight > 0 && <TableHead className="w-24 text-center">TP</TableHead>}
                {u!.examWeight > 0 && <TableHead className="w-16 text-center">Absent</TableHead>}
                <TableHead className="w-28 text-center">Note /20</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheet.rows.map((r) => {
                const d = drafts[r.enrollmentId];
                if (!d) return null;
                const f = finalOf(r);
                const cell = (k: 'cc' | 'exam' | 'tp', label: string, disabled = false) => (
                  <TableCell className="py-2">
                    <Input
                      aria-label={`${label} de ${r.student.firstName} ${r.student.lastName}`}
                      inputMode="decimal" className={cn('h-9 text-center tabular-nums', invalid(d[k]) && 'border-destructive')}
                      value={disabled ? '' : d[k]} placeholder={disabled ? 'ABS' : '—'} disabled={!editable || disabled}
                      onChange={(e) => set(r.enrollmentId, k, e.target.value)}
                    />
                  </TableCell>
                );
                return (
                  <TableRow key={r.enrollmentId}>
                    <TableCell>
                      <p className="font-medium">{r.student.lastName.toUpperCase()} {r.student.firstName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{r.student.matricule}{r.specialty && ` · ${r.specialty}`}</p>
                    </TableCell>
                    {retake && <TableCell className="text-center text-sm text-muted-foreground">CC {formatScore(r.normal?.ccScore)} · note {formatScore(r.normal?.finalScore)}</TableCell>}
                    {!retake && u!.ccWeight > 0 && cell('cc', 'CC')}
                    {u!.examWeight > 0 && cell('exam', 'Examen', d.abs)}
                    {u!.tpWeight > 0 && cell('tp', 'TP')}
                    {u!.examWeight > 0 && (
                      <TableCell className="text-center">
                        <input type="checkbox" className="h-4 w-4" aria-label={`Absent à l'examen : ${r.student.firstName} ${r.student.lastName}`}
                          checked={d.abs} disabled={!editable} onChange={(e) => set(r.enrollmentId, 'abs', e.target.checked)} />
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      {f === null ? <span className="text-muted-foreground">—</span> : (
                        <Badge variant={f >= GRADING_RULES.passMark ? 'success' : 'destructive'} className="tabular-nums text-sm">{formatScore(f)}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
