import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ClipboardList, FileText, Star, Users } from 'lucide-react';
import { formatAmount, formatHours } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { MyTimetable } from './StudentSpace';
import { useCourseStudents, useTeacherSpace } from './me.api';

type Tab = 'courses' | 'timetable';

function StudentsDialog({ ueId, yearId, onClose }: { ueId: string | null; yearId: string; onClose: () => void }) {
  const { data } = useCourseStudents(ueId, yearId);
  return (
    <Dialog open={!!ueId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data ? `${data.teachingUnit.code} — ${data.teachingUnit.title}` : 'Étudiants'}</DialogTitle>
          <DialogDescription>{data?.students.length ?? 0} étudiant(s) inscrit(s)</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Matricule</TableHead><TableHead>Nom</TableHead><TableHead>Spécialité</TableHead><TableHead className="hidden sm:table-cell">Email</TableHead></TableRow></TableHeader>
            <TableBody>
              {data?.students.map((s) => (
                <TableRow key={s.matricule}>
                  <TableCell className="font-mono text-xs">{s.matricule}</TableCell>
                  <TableCell>{s.lastName.toUpperCase()} {s.firstName}</TableCell>
                  <TableCell>{s.specialty ?? '—'}</TableCell>
                  <TableCell className="hidden text-sm sm:table-cell">{s.email ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Espace enseignant : ses UE, ses étudiants, saisie des notes, syllabus, service, emploi du temps. */
export function TeacherSpace() {
  const { data: s, error, isLoading } = useTeacherSpace();
  const [tab, setTab] = useState<Tab>('courses');
  const [studentsOf, setStudentsOf] = useState<string | null>(null);
  if (isLoading) return <p className="text-muted-foreground">Chargement…</p>;
  if (error || !s) return <Card><EmptyState icon={BookOpen} title="Espace indisponible" text={error?.message ?? ''} /></Card>;
  const year = s.academicYear;

  return (
    <div className="space-y-6">
      {s.service && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Heures prévues', formatHours(s.service.assignedTotal), `CM ${s.service.assigned.CM} · TD ${s.service.assigned.TD} · TP ${s.service.assigned.TP}`],
            ['Heures assurées', formatHours(s.service.completedTotal), `CM ${s.service.completed.CM} · TD ${s.service.completed.TD} · TP ${s.service.completed.TP}`],
            ['Équivalent TD', formatHours(s.service.completedTdEquivalent), 'heures assurées'],
            ['Montant estimé', s.service.amountDue !== null ? formatAmount(s.service.amountDue) : '—', s.service.hourlyRate !== null ? `taux ${formatAmount(s.service.hourlyRate)}` : 'taux non renseigné'],
          ].map(([k, v, sub]) => <Card key={k} className="p-4"><p className="text-xs uppercase text-muted-foreground">{k}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p><p className="text-xs text-muted-foreground">{sub}</p></Card>)}
        </div>
      )}
      <Tabs<Tab> value={tab} onChange={setTab} items={[{ value: 'courses', label: `Mes UE${year ? ` (${year.label})` : ''}`, count: s.courses.length }, { value: 'timetable', label: 'Mon emploi du temps' }]} />
      {tab === 'courses' && (!s.courses.length
        ? <Card><EmptyState icon={BookOpen} title="Aucune UE" text="Vous n'êtes affecté à aucune UE pour l'année courante." /></Card>
        : (
          <div className="grid gap-4 md:grid-cols-2">
            {s.courses.map((c) => {
              const pct = c.students ? Math.round((c.gradesEntered / c.students) * 100) : 0;
              return (
                <Card key={c.teachingUnit.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold"><span className="font-mono">{c.teachingUnit.code}</span> — {c.teachingUnit.title}</p>
                      <p className="text-sm text-muted-foreground">{c.teachingUnit.school.code} · {c.teachingUnit.level.name} · S{c.teachingUnit.semester}{c.teachingUnit.specialty ? ` · ${c.teachingUnit.specialty}` : ''}</p>
                    </div>
                    {c.isCoordinator && <Badge><Star className="mr-1 h-3 w-3" /> Responsable</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {c.sessionTypes.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                    <span className="text-muted-foreground">{formatHours(c.completedHours)} assurées / {formatHours(c.assignedHours)} prévues</span>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Notes saisies (session normale)</span><span>{c.gradesEntered}/{c.students}</span></div>
                    <div className="h-2 rounded bg-muted" aria-hidden><div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} /></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" asChild><Link to={`/grades/${c.teachingUnit.id}${year ? `?year=${year.id}` : ''}`}><ClipboardList /> Saisir les notes</Link></Button>
                    <Button size="sm" variant="outline" onClick={() => setStudentsOf(c.teachingUnit.id)}><Users /> Étudiants ({c.students})</Button>
                    <Button size="sm" variant="outline" asChild><Link to={`/syllabus/${c.teachingUnit.id}${year ? `?year=${year.label}` : ''}`}><FileText /> {c.isCoordinator ? 'Rédiger le syllabus' : 'Syllabus'}</Link></Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ))}
      {tab === 'timetable' && <MyTimetable />}
      <StudentsDialog ueId={studentsOf} yearId={year?.id ?? ''} onClose={() => setStudentsOf(null)} />
    </div>
  );
}
