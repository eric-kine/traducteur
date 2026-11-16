import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { createSpecialtySchema, type CreateSpecialtyInput, type SpecialtyDto } from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/common/FormField';
import { applyApiErrors } from '@/lib/form-errors';
import { useSaveSpecialty } from './specialties.api';

export function SpecialtyFormDialog({
  schoolId, open, onClose, specialty,
}: { schoolId: string; open: boolean; onClose: () => void; specialty?: SpecialtyDto | null }) {
  const save = useSaveSpecialty(schoolId);
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<CreateSpecialtyInput>({
    resolver: zodResolver(createSpecialtySchema),
  });

  useEffect(() => {
    if (!open) return;
    reset({
      code: specialty?.code ?? '',
      name: specialty?.name ?? '',
      description: specialty?.description ?? '',
      diplomaTitle: specialty?.diplomaTitle ?? '',
      isActive: specialty?.isActive ?? true,
    });
  }, [open, specialty, reset]);

  const onSubmit = async (values: CreateSpecialtyInput) => {
    try {
      await save.mutateAsync({ ...values, id: specialty?.id });
      toast.success(specialty ? 'Spécialité modifiée' : 'Spécialité créée');
      onClose();
    } catch (err) {
      applyApiErrors(err, setError);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{specialty ? 'Modifier la spécialité' : 'Nouvelle spécialité'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <FormField id="spe-code" label="Code *" error={errors.code?.message}>
              <Input id="spe-code" className="uppercase" maxLength={10} placeholder="GL" {...register('code')} />
            </FormField>
            <FormField id="spe-name" label="Nom *" error={errors.name?.message}>
              <Input id="spe-name" placeholder="Génie Logiciel" {...register('name')} />
            </FormField>
          </div>
          <FormField id="spe-diploma" label="Intitulé du diplôme" error={errors.diplomaTitle?.message}>
            <Input id="spe-diploma" placeholder="Licence en Génie Logiciel" {...register('diplomaTitle')} />
          </FormField>
          <FormField id="spe-description" label="Description" error={errors.description?.message}>
            <Textarea id="spe-description" rows={3} {...register('description')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" {...register('isActive')} /> Spécialité active
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>{specialty ? 'Enregistrer' : 'Créer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
