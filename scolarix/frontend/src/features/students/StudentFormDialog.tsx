import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { GENDER_LABELS, GENDERS, STUDENT_STATUS_LABELS, STUDENT_STATUSES, studentFields, type StudentDto } from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { FormField } from '@/components/common/FormField';
import { applyApiErrors } from '@/lib/form-errors';
import { useAuth } from '@/stores/auth.store';
import { useSchools } from '../schools/schools.api';
import { useCurrentYear } from '../academic-years/academic-years.api';
import { useSaveStudent } from './students.api';
import { EnrollmentSelects } from './LevelSpecialtySelects';

/** Schéma du formulaire : identité + école + inscription facultative (cases vides autorisées). */
const formSchema = z
  .object({
    ...studentFields,
    schoolId: z.string().uuid('École requise'),
    status: z.enum(STUDENT_STATUSES).optional(),
    enroll: z.boolean(),
    academicYearId: z.string().optional(),
    levelId: z.string().optional(),
    specialtyId: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.enroll) return;
    if (!d.academicYearId) ctx.addIssue({ code: 'custom', path: ['academicYearId'], message: 'Année requise' });
    if (!d.levelId) ctx.addIssue({ code: 'custom', path: ['levelId'], message: 'Niveau requis' });
  });
type FormValues = z.input<typeof formSchema>;

const blank = (v: string | null | undefined) => v ?? '';

export function StudentFormDialog({ open, onClose, student }: { open: boolean; onClose: () => void; student?: StudentDto | null }) {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const { data: schools = [] } = useSchools({ isActive: 'true' });
  const currentYear = useCurrentYear();
  const save = useSaveStudent();
  const { register, handleSubmit, reset, watch, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (!open) return;
    const s = student;
    reset({
      firstName: blank(s?.firstName), lastName: blank(s?.lastName), gender: s?.gender ?? 'F', birthDate: blank(s?.birthDate),
      birthPlace: blank(s?.birthPlace), nationality: blank(s?.nationality), email: blank(s?.email), phone: blank(s?.phone),
      address: blank(s?.address), guardianName: blank(s?.guardianName), guardianRelation: blank(s?.guardianRelation),
      guardianPhone: blank(s?.guardianPhone), guardianEmail: blank(s?.guardianEmail), status: s?.status ?? 'ACTIF',
      schoolId: s?.school.id ?? user?.schoolId ?? (schools.length === 1 ? schools[0]!.id : ''),
      enroll: !s, academicYearId: currentYear?.id ?? '', levelId: '', specialtyId: '',
    });
  }, [open, student, reset, user, schools, currentYear]);

  const schoolId = watch('schoolId');
  const enroll = watch('enroll');

  const onSubmit = async (v: FormValues) => {
    const { enroll: _e, academicYearId, levelId, specialtyId, schoolId: sid, status, ...fields } = v;
    try {
      if (student) {
        await save.mutateAsync({ id: student.id, ...fields, status });
        toast.success('Étudiant modifié');
        onClose();
      } else {
        const r = await save.mutateAsync({
          ...fields, schoolId: sid,
          enrollment: enroll ? { academicYearId: academicYearId!, levelId: levelId!, specialtyId: specialtyId || null } : null,
        });
        toast.success(`Étudiant créé — matricule ${(r as { student: StudentDto }).student.matricule}`);
        onClose();
        navigate(`/students/${(r as { student: StudentDto }).student.id}`);
      }
    } catch (e) {
      applyApiErrors(e, setError);
    }
  };

  const text = (name: keyof FormValues & string, label: string, type = 'text') => (
    <FormField id={`st-${name}`} label={label} error={(errors as Record<string, { message?: string }>)[name]?.message}>
      <Input id={`st-${name}`} type={type} {...register(name as 'firstName')} />
    </FormField>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{student ? `Modifier ${student.firstName} ${student.lastName}` : 'Nouvel étudiant'}</DialogTitle>
          <DialogDescription>{student ? `Matricule ${student.matricule}` : 'Le matricule est attribué automatiquement.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">Identité</legend>
            <div className="grid gap-4 sm:grid-cols-2">{text('lastName', 'Nom *')}{text('firstName', 'Prénom *')}</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="st-gender" label="Sexe *" error={errors.gender?.message}>
                <NativeSelect id="st-gender" {...register('gender')}>
                  {GENDERS.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
                </NativeSelect>
              </FormField>
              {text('birthDate', 'Date de naissance *', 'date')}
              {text('birthPlace', 'Lieu de naissance *')}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {text('nationality', 'Nationalité')}
              {text('phone', 'Téléphone', 'tel')}
              {text('email', 'Email', 'email')}
            </div>
            {text('address', 'Adresse')}
            {student && (
              <FormField id="st-status" label="Statut">
                <NativeSelect id="st-status" {...register('status')}>
                  {STUDENT_STATUSES.map((s) => <option key={s} value={s}>{STUDENT_STATUS_LABELS[s]}</option>)}
                </NativeSelect>
              </FormField>
            )}
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">Contact du tuteur</legend>
            <div className="grid gap-4 sm:grid-cols-2">{text('guardianName', 'Nom du tuteur')}{text('guardianRelation', 'Lien (Père, Mère…)')}</div>
            <div className="grid gap-4 sm:grid-cols-2">{text('guardianPhone', 'Téléphone du tuteur', 'tel')}{text('guardianEmail', 'Email du tuteur', 'email')}</div>
          </fieldset>

          {!student && (
            <fieldset className="space-y-4">
              <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">École et inscription</legend>
              <FormField id="st-school" label="École *" error={errors.schoolId?.message}>
                <NativeSelect id="st-school" {...register('schoolId')}>
                  <option value="">—</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                </NativeSelect>
              </FormField>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" {...register('enroll')} /> Inscrire tout de suite à un niveau
              </label>
              {enroll && (
                <EnrollmentSelects prefix="st" schoolId={schoolId} year={register('academicYearId')} level={register('levelId')} specialty={register('specialtyId')}
                  errors={{ academicYearId: errors.academicYearId?.message, levelId: errors.levelId?.message }} />
              )}
            </fieldset>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>{student ? 'Enregistrer' : "Créer l'étudiant"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
