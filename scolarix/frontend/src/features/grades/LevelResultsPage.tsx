import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, FileDown, Gavel, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import { DECISION_LABELS, formatScore, type Decision } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { isAdmin } from '@/lib/permissions';
import { useAuth } from '@/stores/auth.store';
import { useAcademicYears, useCurrentYear } from '../academic-years/academic-years.api';
import { useTeachingUnits } from '../teaching-units/teaching-units.api';
import { openTranscript, useDeliberation, useLevelResults } from './grades.api';

const DECISION_VARIANT: Record<Decision, 'success' | 'destructive' | 'muted' | 'default'> = {
  ADMIS: 'success', ADMIS_AVEC_DETTES: 'default', AJOURNE: 'destructive', INCOMPLET: 'muted',
};

/** Résultats d'un niveau pour une année : moyennes, crédits, décisions, délibération, relevés. */
export function LevelResultsPage() {
  const { id: levelId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const admin = isAdmin(useAuth((s) => s.user));
  const { data: years = [] } = useAcademicYears();
  const current = useCurrentYear();
  const yearId = params.get('year') ?? current?.id ?? '';
  const year = years.find((y) => y.id === yearId);
  const { data: rows = [], isLoading } = useLevelResults(levelId, yearId);
  const { data: units } = useTeachingUnits(levelId);
  const { deliberate, reopen } = useDeliberation(levelId);
  const [confirm, setConfirm] = useState<'deliberate' | 'reopen' | null>(null);

  const deliberated = rows.length > 0 && rows.every((r) => r.deliberatedAt);
  const incomplete = rows.filter((r) => r.year.decision === 'INCOMPLET').length;
  const semesters = [...new Set(rows.flatMap((r) => r.semesters.map((s) => s.number)))].sort();

  return (
    <div className="space-y-6">
      <Link to={`/admin/levels/${levelId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Maquette du niveau
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Résultats et délibération</p>
          <h1 className="text-2xl font-bold">{units?.level.name ?? '…'} <span className="font-mono text-lg text-muted-foreground">({units?.level.code})</span></h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <NativeSelect aria-label="Année académique" className="w-40" value={yearId} onChange={(e) => setParams({ year: e.target.value })}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </NativeSelect>
          {deliberated
            ? admin && <Button variant="outline" onClick={() => setConfirm('reopen')}><LockOpen /> Rouvrir</Button>
            : <Button onClick={() => setConfirm('deliberate')} disabled={!rows.length || incomplete > 0}><Gavel /> Délibérer</Button>}
        </div>
      </div>

      {deliberated
        ? <p className="text-sm text-emerald-700">✔ Délibération faite le {new Date(rows[0]!.deliberatedAt!).toLocaleDateString('fr-FR')} : résultats figés et notes verrouillées.</p>
        : incomplete > 0 && <p className="text-sm text-amber-700">{incomplete} étudiant(s) ont encore des notes manquantes : la délibération sera possible quand toutes les notes seront saisies.</p>}

      <Card>
        {isLoading ? <p className="p-6 text-muted-foreground">Chargement…</p> : !rows.length ? (
          <p className="p-6 text-sm text-muted-foreground">Aucun étudiant inscrit à ce niveau pour {year?.label ?? 'cette année'}.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Étudiant</TableHead>
                {semesters.map((n) => <TableHead key={n} className="hidden text-center md:table-cell">Moy. S{n}</TableHead>)}
                <TableHead className="text-center">Moy. annuelle</TableHead>
                <TableHead className="hidden text-center sm:table-cell">Crédits</TableHead>
                <TableHead className="hidden lg:table-cell">Mention</TableHead>
                <TableHead>Décision</TableHead>
                <TableHead className="text-right">Relevé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.enrollmentId}>
                  <TableCell>
                    <Link to={`/students/${r.student.id}`} className="font-medium hover:underline">{r.student.lastName.toUpperCase()} {r.student.firstName}</Link>
                    <p className="font-mono text-xs text-muted-foreground">{r.student.matricule}</p>
                  </TableCell>
                  {semesters.map((n) => {
                    const s = r.semesters.find((x) => x.number === n);
                    return <TableCell key={n} className="hidden text-center tabular-nums md:table-cell">{formatScore(s?.average)}</TableCell>;
                  })}
                  <TableCell className="text-center font-semibold tabular-nums">{formatScore(r.year.average)}</TableCell>
                  <TableCell className="hidden text-center tabular-nums sm:table-cell">{r.year.creditsEarned}/{r.year.totalCredits}</TableCell>
                  <TableCell className="hidden lg:table-cell">{r.year.mention ?? '—'}</TableCell>
                  <TableCell><Badge variant={DECISION_VARIANT[r.year.decision]}>{DECISION_LABELS[r.year.decision]}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Aperçu du relevé" onClick={() => openTranscript(r.student.id, year!.label, 'html')}><Eye /></Button>
                      <Button variant="ghost" size="icon" title="Relevé de notes (PDF)" onClick={() => openTranscript(r.student.id, year!.label, 'pdf')}><FileDown /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={confirm === 'deliberate'}
        title={`Délibérer ${units?.level.code ?? ''} — ${year?.label ?? ''} ?`}
        description={`Les moyennes, crédits, mentions et décisions de ${rows.length} étudiant(s) seront figés et toutes les notes verrouillées.`}
        confirmLabel="Délibérer"
        onConfirm={async () => {
          const r = await deliberate.mutateAsync(yearId);
          toast.success(`Délibération enregistrée : ${r.admitted}/${r.deliberated} admis`);
        }}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'reopen'}
        title="Rouvrir la délibération ?"
        description="Les notes redeviennent modifiables et les décisions sont effacées. Il faudra délibérer à nouveau."
        confirmLabel="Rouvrir"
        onConfirm={() => reopen.mutateAsync(yearId)}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
