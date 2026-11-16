import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { createTeacherSchema, TEACHER_STATUS_LABELS, TEACHER_STATUSES, type CreateTeacherInput, type TeacherDto } from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { FormField } from '@/components/common/FormField';
import { applyApiErrors } from '@/lib/form-errors';
import { useSaveTeacher } from './teachers.api';

const GRADES = ['Assistant', 'Maître-assistant', 'Maître de conférences', 'Professeur', 'Docteur', 'Ingénieur', 'Expert professionnel'];

export function TeacherFormDialog({ open, onClose, teacher }: { open: boolean; onClose: () => void; teacher?: TeacherDto | null }) {
  const save = useSaveTeacher();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<CreateTeacherInput>({
    resolver: zodResolver(createTeacherSchema),
  });

  useEffect(() => {
    if (!open) return;
    const t = teacher;
    reset({
      title: t?.title ?? '', firstName: t?.firstName ?? '', lastName: t?.lastName ?? '', grade: t?.grade ?? '',
      specialtyField: t?.specialtyField ?? '', email: t?.email ?? '', phone: t?.phone ?? '', status: t?.status ?? 'VACATAIRE',
      hourlyRate: (t?.hourlyRate ?? '') as number, isActive: t?.isActive ?? true,
    });
  }, [open, teacher, reset]);

  const onSubmit = async (v: CreateTeacherInput) => {
    try {
      await save.mutateAsync({ ...v, id: teacher?.id });
      toast.success(teacher ? 'Enseignant modifié' : 'Enseignant créé');
      onClose();
    } catch (e) {
      applyApiErrors(e, setError);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{teacher ? `Modifier ${teacher.firstName} ${teacher.lastName}` : 'Nouvel enseignant'}</DialogTitle>
          <DialogDescription>{teacher ? `N° ${teacher.employeeNumber}` : 'Le numéro (ENS-…) est attribué automatiquement.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[100px_1fr_1fr]">
            <FormField id="t-title" label="Titre" error={errors.title?.message}>
              <Input id="t-title" placeholder="Dr" list="teacher-titles" {...register('title')} />
              <datalist id="teacher-titles"><option value="M." /><option value="Mme" /><option value="Dr" /><option value="Pr" /></datalist>
            </FormField>
            <FormField id="t-last" label="Nom *" error={errors.lastName?.message}><Input id="t-last" {...register('lastName')} /></FormField>
            <FormField id="t-first" label="Prénom *" error={errors.firstName?.message}><Input id="t-first" {...register('firstName')} /></FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="t-grade" label="Grade" error={errors.grade?.message}>
              <Input id="t-grade" list="teacher-grades" placeholder="Maître de conférences" {...register('grade')} />
              <datalist id="teacher-grades">{GRADES.map((g) => <option key={g} value={g} />)}</datalist>
            </FormField>
            <FormField id="t-field" label="Spécialité / domaine" error={errors.specialtyField?.message}>
              <Input id="t-field" placeholder="Informatique, Réseaux…" {...register('specialtyField')} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="t-email" label="Email *" error={errors.email?.message}><Input id="t-email" type="email" {...register('email')} /></FormField>
            <FormField id="t-phone" label="Téléphone" error={errors.phone?.message}><Input id="t-phone" type="tel" {...register('phone')} /></FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="t-status" label="Statut *" error={errors.status?.message}>
              <NativeSelect id="t-status" {...register('status')}>
                {TEACHER_STATUSES.map((s) => <option key={s} value={s}>{TEACHER_STATUS_LABELS[s]}</option>)}
              </NativeSelect>
            </FormField>
            <FormField id="t-rate" label="Taux horaire" error={errors.hourlyRate?.message}>
              <Input id="t-rate" type="number" min={0} step={100} placeholder="ex. 10000" {...register('hourlyRate')} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" {...register('isActive')} /> Enseignant actif</label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>{teacher ? 'Enregistrer' : 'Créer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
