import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Plus, Search, Upload } from 'lucide-react';
import { ENROLLMENT_STATUS_LABELS, STUDENT_STATUS_LABELS, STUDENT_STATUSES, type StudentStatus } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuth } from '@/stores/auth.store';
import { useSchools } from '../schools/schools.api';
import { useLevels } from '../levels/levels.api';
import { useSpecialties } from '../specialties/specialties.api';
import { useAcademicYears } from '../academic-years/academic-years.api';
import { useStudents, type StudentFilters } from './students.api';
import { StudentAvatar } from './StudentAvatar';
import { StudentFormDialog } from './StudentFormDialog';
import { ImportStudentsDialog } from './ImportStudentsDialog';

export const STATUS_VARIANT: Record<StudentStatus, 'success' | 'muted' | 'destructive' | 'secondary'> = {
  ACTIF: 'success', SUSPENDU: 'destructive', DIPLOME: 'secondary', ABANDON: 'muted', EXCLU: 'destructive',
};

export function StudentsPage() {
  const user = useAuth((s) => s.user);
  const { data: schools = [] } = useSchools();
  const { data: years = [] } = useAcademicYears();
  const [f, setF] = useState<StudentFilters>({ page: 1, schoolId: user?.schoolId ?? '' });
  const [search, setSearch] = useState('');
  const { data: levels = [] } = useLevels(f.schoolId ?? '');
  const { data: specialties = [] } = useSpecialties(f.schoolId ?? '');
  const { data, isLoading } = useStudents(f);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setF((x) => ({ ...x, search, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [search]);

  const set = (k: keyof StudentFilters) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value, page: 1, ...(k === 'schoolId' && { levelId: '', specialtyId: '' }) }));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Étudiants</h1>
          <p className="text-muted-foreground">{data ? `${data.total} étudiant(s)` : ' '}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload /> Importer (CSV)</Button>
          <Button onClick={() => setFormOpen(true)}><Plus /> Nouvel étudiant</Button>
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher (nom, prénom, matricule)…" aria-label="Rechercher un étudiant" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <NativeSelect aria-label="École" value={f.schoolId} onChange={set('schoolId')} disabled={!!user?.schoolId}>
            <option value="">Toutes les écoles</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Année" value={f.academicYearId} onChange={set('academicYearId')}>
            <option value="">Toutes les années</option>
            {years.map((y) => <option key={y.id} value={y.id}>Inscrits {y.label}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Niveau" value={f.levelId} onChange={set('levelId')} disabled={!f.schoolId}>
            <option value="">{f.schoolId ? 'Tous les niveaux' : 'Niveau (choisir une école)'}</option>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Spécialité" value={f.specialtyId} onChange={set('specialtyId')} disabled={!f.schoolId}>
            <option value="">Toutes les spécialités</option>
            {specialties.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Statut" value={f.status} onChange={set('status')}>
            <option value="">Tous les statuts</option>
            {STUDENT_STATUSES.map((s) => <option key={s} value={s}>{STUDENT_STATUS_LABELS[s]}</option>)}
          </NativeSelect>
        </div>
      </Card>

      <Card>
        {isLoading ? <p className="p-6 text-muted-foreground">Chargement…</p> : !data?.data.length ? (
          <EmptyState icon={GraduationCap} title="Aucun étudiant" text="Ajoutez un étudiant ou importez une liste au format CSV." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Étudiant</TableHead>
                  <TableHead className="hidden md:table-cell">Matricule</TableHead>
                  <TableHead className="hidden lg:table-cell">École</TableHead>
                  <TableHead>Inscription</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link to={`/students/${s.id}`} className="flex items-center gap-3 hover:underline">
                        <StudentAvatar student={s} />
                        <span className="font-medium">{s.lastName.toUpperCase()} {s.firstName}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden font-mono text-sm md:table-cell">{s.matricule}</TableCell>
                    <TableCell className="hidden lg:table-cell">{s.school.code}</TableCell>
                    <TableCell className="text-sm">
                      {s.currentEnrollment ? (
                        <>
                          <span className="font-medium">{s.currentEnrollment.level.code}</span>
                          {s.currentEnrollment.specialty && <> · {s.currentEnrollment.specialty.code}</>}
                          <span className="block text-xs text-muted-foreground">
                            {s.currentEnrollment.academicYear.label} — {ENROLLMENT_STATUS_LABELS[s.currentEnrollment.status]}
                          </span>
                        </>
                      ) : <span className="text-muted-foreground">Non inscrit</span>}
                    </TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[s.status]}>{STUDENT_STATUS_LABELS[s.status]}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-end gap-2 border-t p-4 text-sm text-muted-foreground">
              <Button variant="outline" size="sm" disabled={f.page <= 1} onClick={() => setF((x) => ({ ...x, page: x.page - 1 }))}>Précédent</Button>
              <span>Page {f.page} / {pages}</span>
              <Button variant="outline" size="sm" disabled={f.page >= pages} onClick={() => setF((x) => ({ ...x, page: x.page + 1 }))}>Suivant</Button>
            </div>
          </>
        )}
      </Card>

      <StudentFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
      <ImportStudentsDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
