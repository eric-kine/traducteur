import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUSES, type EnrollmentDto, type EnrollmentStatus } from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/select';
import { FormField } from '@/components/common/FormField';
import { applyApiErrors } from '@/lib/form-errors';
import { useCurrentYear } from '../academic-years/academic-years.api';
import { useSaveEnrollment } from './students.api';
import { EnrollmentSelects } from './LevelSpecialtySelects';

interface Values { academicYearId: string; levelId: string; specialtyId: string; status: EnrollmentStatus; isRepeating: boolean }

/** Inscrire un étudiant à un niveau pour une année (ou modifier l'inscription). */
export function EnrollmentDialog({
  open, onClose, studentId, schoolId, enrollment,
}: { open: boolean; onClose: () => void; studentId: string; schoolId: string; enrollment?: EnrollmentDto | null }) {
  const save = useSaveEnrollment();
  const currentYear = useCurrentYear();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<Values>();

  useEffect(() => {
    if (!open) return;
    reset(enrollment
      ? { academicYearId: enrollment.academicYear.id, levelId: enrollment.level.id, specialtyId: enrollment.specialty?.id ?? '', status: enrollment.status, isRepeating: enrollment.isRepeating }
      : { academicYearId: currentYear?.id ?? '', levelId: '', specialtyId: '', status: 'INSCRIT', isRepeating: false });
  }, [open, enrollment, currentYear, reset]);

  const onSubmit = async (v: Values) => {
    try {
      if (enrollment) {
        await save.mutateAsync({ id: enrollment.id, levelId: v.levelId, specialtyId: v.specialtyId || null, status: v.status, isRepeating: v.isRepeating });
      } else {
        await save.mutateAsync({ studentId, ...v, specialtyId: v.specialtyId || null });
      }
      toast.success('Inscription enregistrée');
      onClose();
    } catch (e) {
      applyApiErrors(e, setError);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{enrollment ? `Inscription ${enrollment.academicYear.label}` : 'Nouvelle inscription'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <EnrollmentSelects prefix="en" schoolId={schoolId}
            year={enrollment ? undefined : register('academicYearId', { required: 'Année requise' })}
            level={register('levelId', { required: 'Niveau requis' })} specialty={register('specialtyId')}
            errors={{ academicYearId: errors.academicYearId?.message, levelId: errors.levelId?.message, specialtyId: errors.specialtyId?.message }} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="en-status" label="Statut">
              <NativeSelect id="en-status" {...register('status')}>
                {ENROLLMENT_STATUSES.map((s) => <option key={s} value={s}>{ENROLLMENT_STATUS_LABELS[s]}</option>)}
              </NativeSelect>
            </FormField>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className="h-4 w-4" {...register('isRepeating')} /> Redoublant
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
