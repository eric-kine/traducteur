import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { formatAmount, formatHours, PAID_HOURS_COEFFICIENTS, TEACHER_STATUS_LABELS, type AssignmentDto } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { NotFoundPage } from '@/routes/ErrorPages';
import { isAdmin } from '@/lib/permissions';
import { useAuth } from '@/stores/auth.store';
import { useAcademicYears, useCurrentYear } from '../academic-years/academic-years.api';
import { useAssignments, useDeleteAssignment, useDeleteTeacher, useTeacher, useTeacherService } from './teachers.api';
import { TeacherFormDialog } from './TeacherFormDialog';
import { AssignmentDialog } from './AssignmentDialog';
import { TeacherAvailabilityCard } from './TeacherAvailabilityCard';
import { AccountCard } from '../accounts/AccountCard';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

export function TeacherDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const admin = isAdmin(useAuth((s) => s.user));
  const { data: t, isLoading } = useTeacher(id);
  const { data: years = [] } = useAcademicYears();
  const current = useCurrentYear();
  const [yearId, setYearId] = useState('');
  useEffect(() => { if (!yearId && current) setYearId(current.id); }, [current, yearId]);
  const { data: assignments = [] } = useAssignments({ teacherId: id, academicYearId: yearId });
  const { data: service } = useTeacherService(id, yearId);
  const delAssignment = useDeleteAssignment();
  const delTeacher = useDeleteTeacher();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<{ open: boolean; assignment?: AssignmentDto | null }>({ open: false });
  const [confirm, setConfirm] = useState<null | 'teacher' | AssignmentDto>(null);

  if (isLoading) return <p className="text-muted-foreground">Chargement…</p>;
  if (!t) return <NotFoundPage />;
  const yearLabel = years.find((y) => y.id === yearId)?.label ?? '';

  return (
    <div className="space-y-6">
      <Link to="/teachers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Tous les enseignants
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{t.employeeNumber}</p>
          <h1 className="text-2xl font-bold">{t.title} {t.lastName.toUpperCase()} {t.firstName}</h1>
          <p className="text-muted-foreground">{[t.grade, t.specialtyField].filter(Boolean).join(' · ') || '—'}</p>
          <p className="text-sm text-muted-foreground">{t.email}{t.phone && ` · ${t.phone}`}</p>
          <div className="mt-2 flex gap-2">
            <Badge>{TEACHER_STATUS_LABELS[t.status]}</Badge>
            <Badge variant="secondary">Taux horaire : {t.hourlyRate !== null ? formatAmount(t.hourlyRate) : 'non renseigné'}</Badge>
            {!t.isActive && <Badge variant="muted">Inactif</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil /> Modifier</Button>
          {admin && <Button variant="outline" onClick={() => setConfirm('teacher')}><Trash2 className="text-destructive" /> Supprimer</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Service d'enseignement</h2>
        <div className="flex gap-2">
          <NativeSelect aria-label="Année académique" className="w-44" value={yearId} onChange={(e) => setYearId(e.target.value)}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </NativeSelect>
          <Button onClick={() => setForm({ open: true })} disabled={!yearId || !t.isActive}><Plus /> Affecter à une UE</Button>
        </div>
      </div>
      {!years.length && <p className="text-sm text-destructive">Créez d'abord une année académique (Administration → Années académiques).</p>}

      {service && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Heures prévues" value={formatHours(service.assignedTotal)} sub={`CM ${service.assigned.CM} · TD ${service.assigned.TD} · TP ${service.assigned.TP}`} />
          <Stat label="Heures assurées" value={formatHours(service.completedTotal)} sub={`CM ${service.completed.CM} · TD ${service.completed.TD} · TP ${service.completed.TP}`} />
          <Stat label="Équivalent TD" value={formatHours(service.completedTdEquivalent)} sub={`CM × ${formatAmount(PAID_HOURS_COEFFICIENTS.cm)} + TD + TP (heures assurées)`} />
          <Stat label="Montant dû" value={service.amountDue !== null ? formatAmount(service.amountDue) : '—'} sub={service.hourlyRate !== null ? `équivalent TD × ${formatAmount(service.hourlyRate)}` : 'Renseignez le taux horaire'} />
        </div>
      )}

      <Card>
        {!assignments.length ? (
          <p className="p-6 text-sm text-muted-foreground">Aucune affectation pour {yearLabel || 'cette année'}.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UE</TableHead>
                <TableHead className="hidden md:table-cell">École / niveau</TableHead>
                <TableHead className="text-center">Type</TableHead>
                <TableHead className="text-center">Prévues</TableHead>
                <TableHead className="text-center">Assurées</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => {
                const pct = a.assignedHours ? Math.round((a.completedHours / a.assignedHours) * 100) : 0;
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <span className="font-mono text-sm">{a.teachingUnit.code}</span> {a.teachingUnit.title}
                      {a.isCoordinator && <Badge variant="default" className="ml-2"><Star className="mr-1 h-3 w-3" /> Responsable</Badge>}
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{a.teachingUnit.level.school.code} · {a.teachingUnit.level.code} · S{a.teachingUnit.semester}</TableCell>
                    <TableCell className="text-center"><Badge variant="secondary">{a.sessionType}</Badge></TableCell>
                    <TableCell className="text-center tabular-nums">{formatAmount(a.assignedHours)}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {formatAmount(a.completedHours)}
                      <div className="mx-auto mt-1 h-1.5 w-16 rounded bg-muted" aria-hidden><div className="h-1.5 rounded bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Modifier les heures" onClick={() => setForm({ open: true, assignment: a })}><Pencil /></Button>
                        <Button variant="ghost" size="icon" title="Retirer l'affectation" onClick={() => setConfirm(a)}><Trash2 className="text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <TeacherAvailabilityCard teacher={t} />
        <AccountCard kind="teachers" id={t.id} email={t.email} />
      </div>

      <TeacherFormDialog open={editOpen} teacher={t} onClose={() => setEditOpen(false)} />
      <AssignmentDialog open={form.open} assignment={form.assignment} teacherId={t.id} academicYearId={yearId} yearLabel={yearLabel} onClose={() => setForm({ open: false })} />
      <ConfirmDialog
        open={!!confirm}
        title={confirm === 'teacher' ? `Supprimer ${t.firstName} ${t.lastName} ?` : `Retirer l'affectation ${(confirm as AssignmentDto | null)?.teachingUnit?.code ?? ''} ?`}
        description={confirm === 'teacher' ? "Impossible s'il a des affectations ou des notes saisies : désactivez-le plutôt." : 'Les heures redeviennent disponibles pour un autre enseignant.'}
        confirmLabel={confirm === 'teacher' ? 'Supprimer' : 'Retirer'}
        onConfirm={async () => {
          if (confirm === 'teacher') { await delTeacher.mutateAsync(t.id); navigate('/teachers'); }
          else if (confirm) await delAssignment.mutateAsync(confirm.id);
        }}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
