import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookMarked, ClipboardList, Pencil, Plus, Search, Trash2, Trophy } from 'lucide-react';
import { formatAmount, formatHours, type TeachingUnitDto, type TeachingUnitTotals } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ApiError } from '@/lib/api';
import { canManageSchool } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/auth.store';
import { NotFoundPage } from '@/routes/ErrorPages';
import { useSchool } from '../schools/schools.api';
import { useSpecialties } from '../specialties/specialties.api';
import { useDeleteTeachingUnit, useTeachingUnits, type TeachingUnitFilters } from './teaching-units.api';
import { TeachingUnitFormDialog } from './TeachingUnitFormDialog';

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', warn && 'text-amber-600')}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

const h = (n: number) => (n ? formatAmount(n) : '—');

/** Ligne de sous-total d'un semestre. */
function TotalsRow({ label, t, canEdit }: { label: string; t: TeachingUnitTotals; canEdit: boolean }) {
  return (
    <TableRow className="bg-muted/60 font-semibold hover:bg-muted/60">
      <TableCell colSpan={2}>{label}</TableCell>
      <TableCell className="text-center">{t.credits}</TableCell>
      <TableCell className="hidden text-center md:table-cell" />
      <TableCell className="hidden text-center lg:table-cell">{h(t.cmHours)}</TableCell>
      <TableCell className="hidden text-center lg:table-cell">{h(t.tdHours)}</TableCell>
      <TableCell className="hidden text-center lg:table-cell">{h(t.tpHours)}</TableCell>
      <TableCell className="text-center">{h(t.totalHours)}</TableCell>
      <TableCell className="hidden text-center sm:table-cell">{h(t.paidHours)}</TableCell>
      {canEdit && <TableCell />}
    </TableRow>
  );
}

/** Maquette pédagogique d'un niveau : ses UE par semestre, avec totaux. */
export function LevelCurriculumPage() {
  const { id: levelId = '' } = useParams();
  const user = useAuth((s) => s.user);
  const [filters, setFilters] = useState<TeachingUnitFilters>({ semester: '', specialtyId: '', search: '' });
  const { data, isLoading, error } = useTeachingUnits(levelId, filters);
  const schoolId = data?.level.schoolId ?? '';
  const { data: school } = useSchool(schoolId);
  const { data: specialties = [] } = useSpecialties(schoolId);
  const del = useDeleteTeachingUnit(levelId);
  const [form, setForm] = useState<{ open: boolean; unit?: TeachingUnitDto | null; semester?: number }>({ open: false });
  const [toDelete, setToDelete] = useState<TeachingUnitDto | null>(null);

  if (isLoading && !data) return <p className="text-muted-foreground">Chargement…</p>;
  if (error instanceof ApiError && error.status === 403) return <p className="text-destructive">Vous n'avez pas accès à ce niveau.</p>;
  if (!data) return <NotFoundPage />;

  const { level, totals } = data;
  const canEdit = canManageSchool(user, level.schoolId);
  const filtered = !!(filters.semester || filters.specialtyId || filters.search);
  const creditsGap = totals.year.credits - level.requiredCredits;

  const unitRow = (u: TeachingUnitDto) => (
    <TableRow key={u.id} className={u.isActive ? '' : 'opacity-60'}>
      <TableCell><Badge variant="secondary" className="font-mono">{u.code}</Badge></TableCell>
      <TableCell>
        <p className="font-medium">{u.title}</p>
        <p className="text-xs text-muted-foreground">{u.specialty ? `Spécialité ${u.specialty.code}` : 'Tronc commun'} · coef. {formatAmount(u.coefficient)}</p>
      </TableCell>
      <TableCell className="text-center">{u.credits}</TableCell>
      <TableCell className="hidden text-center md:table-cell">{u.ccWeight}/{u.examWeight}/{u.tpWeight}</TableCell>
      <TableCell className="hidden text-center lg:table-cell">{h(u.cmHours)}</TableCell>
      <TableCell className="hidden text-center lg:table-cell">{h(u.tdHours)}</TableCell>
      <TableCell className="hidden text-center lg:table-cell">{h(u.tpHours)}</TableCell>
      <TableCell className="text-center font-medium">{h(u.totalHours)}</TableCell>
      <TableCell className="hidden text-center sm:table-cell">
        {h(u.paidHours)}
        {!u.paidHoursAuto && <span title="Saisi manuellement" className="ml-1 text-xs text-muted-foreground">✎</span>}
      </TableCell>
      {canEdit && (
        <TableCell>
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" title="Saisir les notes" asChild><Link to={`/grades/${u.id}`}><ClipboardList /></Link></Button>
            <Button variant="ghost" size="icon" title="Modifier" onClick={() => setForm({ open: true, unit: u })}><Pencil /></Button>
            <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setToDelete(u)}><Trash2 className="text-destructive" /></Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <Link to={`/admin/schools/${level.schoolId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {school?.name ?? "Retour à l'école"}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Maquette pédagogique</p>
          <h1 className="text-2xl font-bold">{level.name} <span className="font-mono text-lg text-muted-foreground">({level.code})</span></h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to={`/admin/levels/${levelId}/results`}><Trophy /> Résultats</Link></Button>
          {canEdit && <Button onClick={() => setForm({ open: true, unit: null })}><Plus /> Nouvelle UE</Button>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Crédits ECTS"
          value={`${totals.year.credits} / ${level.requiredCredits}`}
          sub={filtered ? 'selon le filtre' : creditsGap === 0 ? 'Objectif atteint' : creditsGap < 0 ? `Il manque ${-creditsGap} crédit(s)` : `${creditsGap} crédit(s) en trop`}
          warn={!filtered && creditsGap !== 0}
        />
        <Stat label="Volume total" value={formatHours(totals.year.totalHours)} sub={`CM ${h(totals.year.cmHours)} · TD ${h(totals.year.tdHours)} · TP ${h(totals.year.tpHours)}`} />
        <Stat label="Volume payé" value={formatHours(totals.year.paidHours)} sub="équivalent TD ou saisi" />
        <Stat label="Coût estimé" value={formatAmount(totals.year.estimatedCost)} sub={`${totals.year.count} UE`} />
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Rechercher (code, intitulé)…" aria-label="Rechercher une UE" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
          </div>
          <NativeSelect aria-label="Semestre" value={filters.semester} onChange={(e) => setFilters((f) => ({ ...f, semester: e.target.value as TeachingUnitFilters['semester'] }))}>
            <option value="">Les 2 semestres</option>
            <option value="1">Semestre 1</option>
            <option value="2">Semestre 2</option>
          </NativeSelect>
          <NativeSelect aria-label="Spécialité" value={filters.specialtyId} onChange={(e) => setFilters((f) => ({ ...f, specialtyId: e.target.value }))}>
            <option value="">Toutes les UE</option>
            <option value="common">Tronc commun uniquement</option>
            {specialties.map((s) => <option key={s.id} value={s.id}>{s.code} (+ tronc commun)</option>)}
          </NativeSelect>
        </div>
      </Card>

      <Card>
        {!data.data.length ? (
          <EmptyState
            icon={BookMarked}
            title={filtered ? 'Aucune UE ne correspond' : 'Aucune UE dans ce niveau'}
            text={filtered ? 'Modifiez les filtres.' : 'Ajoutez les unités d’enseignement de la maquette.'}
            action={canEdit && !filtered && <Button onClick={() => setForm({ open: true, unit: null })}><Plus /> Nouvelle UE</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Code</TableHead>
                <TableHead>Intitulé</TableHead>
                <TableHead className="text-center">Crédits</TableHead>
                <TableHead className="hidden text-center md:table-cell" title="Contrôle continu / Examen / TP (%)">CC/Ex/TP</TableHead>
                <TableHead className="hidden text-center lg:table-cell">CM</TableHead>
                <TableHead className="hidden text-center lg:table-cell">TD</TableHead>
                <TableHead className="hidden text-center lg:table-cell">TP</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="hidden text-center sm:table-cell">Payé</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {([1, 2] as const).map((sem) => {
                const units = data.data.filter((u) => u.semester === sem);
                if (!units.length) return null;
                return (
                  <Fragment key={sem}>
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={canEdit ? 10 : 9} className="pb-1 pt-5 text-xs font-semibold uppercase tracking-wide text-primary">
                        Semestre {sem}
                      </TableCell>
                    </TableRow>
                    {units.map(unitRow)}
                    <TotalsRow label={`Total semestre ${sem}`} t={sem === 1 ? totals.semester1 : totals.semester2} canEdit={canEdit} />
                  </Fragment>
                );
              })}
              <TotalsRow label="Total année" t={totals.year} canEdit={canEdit} />
            </TableBody>
          </Table>
        )}
      </Card>

      <TeachingUnitFormDialog levelId={levelId} open={form.open} unit={form.unit} specialties={specialties} onClose={() => setForm({ open: false })} />
      <ConfirmDialog
        open={!!toDelete}
        title={`Supprimer l'UE ${toDelete?.code} ?`}
        description="Impossible si des notes, affectations, syllabus ou créneaux y sont rattachés : désactivez-la alors."
        onConfirm={() => del.mutateAsync(toDelete!.id)}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
