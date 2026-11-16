import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, FileDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import { openTranscript } from '../grades/grades.api';
import { toast } from 'sonner';
import { ENROLLMENT_STATUS_LABELS, GENDER_LABELS, STUDENT_STATUS_LABELS, type EnrollmentDto } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { NotFoundPage } from '@/routes/ErrorPages';
import { useDeleteEnrollment, useDeleteStudent, useStudent, useStudentEnrollments, useStudentPhotoMutations } from './students.api';
import { StudentAvatar } from './StudentAvatar';
import { StudentFormDialog } from './StudentFormDialog';
import { EnrollmentDialog } from './EnrollmentDialog';
import { STATUS_VARIANT } from './StudentsPage';

const Info = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="font-medium">{value || '—'}</dd>
  </div>
);

export function StudentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: s, isLoading } = useStudent(id);
  const { data: enrollments = [] } = useStudentEnrollments(id);
  const photo = useStudentPhotoMutations(id);
  const delStudent = useDeleteStudent();
  const delEnrollment = useDeleteEnrollment();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState<{ open: boolean; enrollment?: EnrollmentDto | null }>({ open: false });
  const [confirm, setConfirm] = useState<null | 'student' | EnrollmentDto>(null);

  if (isLoading) return <p className="text-muted-foreground">Chargement…</p>;
  if (!s) return <NotFoundPage />;

  const onPhoto = async (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('Photo trop lourde (2 Mo maximum)');
    try {
      await photo.upload.mutateAsync(file);
      setPhotoVersion((v) => v + 1);
      toast.success('Photo enregistrée');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/students" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Tous les étudiants
      </Link>

      <div className="flex flex-wrap items-start gap-6">
        <div className="relative">
          <StudentAvatar student={s} size="xl" version={photoVersion} />
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} aria-label="Choisir une photo" />
          <div className="absolute -bottom-1 right-0 flex gap-1">
            <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow" title="Changer la photo" onClick={() => fileInput.current?.click()}><Camera /></Button>
            {s.hasPhoto && (
              <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow" title="Retirer la photo"
                onClick={() => photo.remove.mutate(undefined, { onSuccess: () => toast.success('Photo retirée') })}><X /></Button>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm text-muted-foreground">{s.matricule}</p>
          <h1 className="text-2xl font-bold">{s.lastName.toUpperCase()} {s.firstName}</h1>
          <p className="text-muted-foreground">{s.school.name}</p>
          <Badge className="mt-2" variant={STATUS_VARIANT[s.status]}>{STUDENT_STATUS_LABELS[s.status]}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil /> Modifier</Button>
          <Button variant="outline" onClick={() => setConfirm('student')}><Trash2 className="text-destructive" /> Supprimer</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">État civil et contact</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Sexe" value={GENDER_LABELS[s.gender]} />
              <Info label="Né(e) le" value={`${new Date(s.birthDate).toLocaleDateString('fr-FR', { timeZone: 'UTC' })} à ${s.birthPlace}`} />
              <Info label="Nationalité" value={s.nationality} />
              <Info label="Téléphone" value={s.phone} />
              <Info label="Email" value={s.email} />
              <Info label="Adresse" value={s.address} />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Tuteur / contact d'urgence</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Nom" value={s.guardianName} />
              <Info label="Lien" value={s.guardianRelation} />
              <Info label="Téléphone" value={s.guardianPhone} />
              <Info label="Email" value={s.guardianEmail} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">Inscriptions</h2>
          <Button size="sm" onClick={() => setEnrollForm({ open: true })}><Plus /> Inscrire</Button>
        </div>
        {!enrollments.length ? (
          <p className="p-6 text-sm text-muted-foreground">Aucune inscription pour l'instant.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Année</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Spécialité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.academicYear.label}</TableCell>
                  <TableCell>{e.level.code} — {e.level.name}{e.isRepeating && <Badge variant="muted" className="ml-2">Redoublant</Badge>}</TableCell>
                  <TableCell>{e.specialty ? `${e.specialty.code} — ${e.specialty.name}` : 'Tronc commun'}</TableCell>
                  <TableCell><Badge variant={e.status === 'INSCRIT' || e.status === 'ADMIS' ? 'success' : 'muted'}>{ENROLLMENT_STATUS_LABELS[e.status]}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Relevé de notes (PDF)" onClick={() => openTranscript(s.id, e.academicYear.label)}><FileDown /></Button>
                      <Button variant="ghost" size="icon" title="Modifier l'inscription" onClick={() => setEnrollForm({ open: true, enrollment: e })}><Pencil /></Button>
                      <Button variant="ghost" size="icon" title="Supprimer l'inscription" onClick={() => setConfirm(e)}><Trash2 className="text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <StudentFormDialog open={editOpen} student={s} onClose={() => setEditOpen(false)} />
      <EnrollmentDialog open={enrollForm.open} enrollment={enrollForm.enrollment} studentId={s.id} schoolId={s.school.id} onClose={() => setEnrollForm({ open: false })} />
      <ConfirmDialog
        open={!!confirm}
        title={confirm === 'student' ? `Supprimer ${s.firstName} ${s.lastName} ?` : `Supprimer l'inscription ${(confirm as EnrollmentDto | null)?.academicYear?.label ?? ''} ?`}
        description={confirm === 'student'
          ? "Possible seulement s'il n'a ni note ni document émis. Sinon, changez son statut (Abandon, Diplômé…)."
          : "Possible seulement si aucune note n'a été saisie pour cette inscription."}
        onConfirm={async () => {
          if (confirm === 'student') { await delStudent.mutateAsync(s.id); navigate('/students'); }
          else if (confirm) await delEnrollment.mutateAsync(confirm.id);
        }}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
