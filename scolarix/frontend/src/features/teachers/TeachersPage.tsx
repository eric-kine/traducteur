import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, UserSquare2 } from 'lucide-react';
import { formatAmount, TEACHER_STATUS_LABELS, TEACHER_STATUSES } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { useTeachers } from './teachers.api';
import { TeacherFormDialog } from './TeacherFormDialog';

export function TeachersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const { data = [], isLoading } = useTeachers({ status });
  const [formOpen, setFormOpen] = useState(false);
  const q = search.trim().toLowerCase();
  const visible = data.filter((t) => !q || `${t.lastName} ${t.firstName} ${t.email} ${t.employeeNumber} ${t.specialtyField ?? ''}`.toLowerCase().includes(q));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Enseignants</h1>
          <p className="text-muted-foreground">{data.length} enseignant(s)</p>
        </div>
        <Button onClick={() => setFormOpen(true)}><Plus /> Nouvel enseignant</Button>
      </div>
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Rechercher (nom, email, spécialité, n°)…" aria-label="Rechercher un enseignant" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <NativeSelect aria-label="Statut" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            {TEACHER_STATUSES.map((s) => <option key={s} value={s}>{TEACHER_STATUS_LABELS[s]}</option>)}
          </NativeSelect>
        </div>
      </Card>
      <Card>
        {isLoading ? <p className="p-6 text-muted-foreground">Chargement…</p> : !visible.length ? (
          <EmptyState icon={UserSquare2} title="Aucun enseignant" text="Ajoutez les enseignants pour pouvoir les affecter aux UE." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Enseignant</TableHead>
                <TableHead className="hidden md:table-cell">Grade / spécialité</TableHead>
                <TableHead className="hidden lg:table-cell">Contact</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Taux horaire</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((t) => (
                <TableRow key={t.id} className={t.isActive ? '' : 'opacity-60'}>
                  <TableCell>
                    <Link to={`/teachers/${t.id}`} className="font-medium hover:underline">{t.title} {t.lastName.toUpperCase()} {t.firstName}</Link>
                    <p className="font-mono text-xs text-muted-foreground">{t.employeeNumber}</p>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{t.grade ?? '—'}<p className="text-xs text-muted-foreground">{t.specialtyField}</p></TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">{t.email}<p className="text-xs text-muted-foreground">{t.phone}</p></TableCell>
                  <TableCell>
                    <Badge variant={t.status === 'PERMANENT' ? 'default' : 'secondary'}>{TEACHER_STATUS_LABELS[t.status]}</Badge>
                    {!t.isActive && <Badge variant="muted" className="ml-1">Inactif</Badge>}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{t.hourlyRate !== null ? formatAmount(t.hourlyRate) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <TeacherFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
