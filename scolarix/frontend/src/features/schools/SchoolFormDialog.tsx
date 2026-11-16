import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { createSchoolSchema, type CreateSchoolInput, type SchoolDto } from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/common/FormField';
import { applyApiErrors } from '@/lib/form-errors';
import { useSaveSchool } from './schools.api';

const EMPTY: CreateSchoolInput = { code: '', name: '', description: '', directorName: '', email: '', phone: '', address: '', isActive: true };

export function SchoolFormDialog({ open, onClose, school }: { open: boolean; onClose: () => void; school?: SchoolDto | null }) {
  const save = useSaveSchool();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<CreateSchoolInput>({
    resolver: zodResolver(createSchoolSchema),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      school
        ? {
            code: school.code, name: school.name, description: school.description ?? '', directorName: school.directorName ?? '',
            email: school.email ?? '', phone: school.phone ?? '', address: school.address ?? '', isActive: school.isActive,
          }
        : EMPTY,
    );
  }, [open, school, reset]);

  const onSubmit = async (values: CreateSchoolInput) => {
    try {
      await save.mutateAsync({ ...values, id: school?.id });
      toast.success(school ? 'École modifiée' : 'École créée');
      onClose();
    } catch (err) {
      applyApiErrors(err, setError);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{school ? "Modifier l'école" : 'Nouvelle école'}</DialogTitle>
          <DialogDescription>Le code court (ex. EIT) sert dans les matricules des étudiants.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <FormField id="school-code" label="Code *" error={errors.code?.message}>
              <Input id="school-code" className="uppercase" maxLength={10} aria-invalid={!!errors.code} {...register('code')} />
            </FormField>
            <FormField id="school-name" label="Nom *" error={errors.name?.message}>
              <Input id="school-name" aria-invalid={!!errors.name} {...register('name')} />
            </FormField>
          </div>
          <FormField id="school-description" label="Description" error={errors.description?.message}>
            <Textarea id="school-description" rows={2} {...register('description')} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="school-director" label="Directeur / Directrice" error={errors.directorName?.message}>
              <Input id="school-director" {...register('directorName')} />
            </FormField>
            <FormField id="school-phone" label="Téléphone" error={errors.phone?.message}>
              <Input id="school-phone" type="tel" {...register('phone')} />
            </FormField>
            <FormField id="school-email" label="Email" error={errors.email?.message}>
              <Input id="school-email" type="email" {...register('email')} />
            </FormField>
            <FormField id="school-address" label="Adresse" error={errors.address?.message}>
              <Input id="school-address" {...register('address')} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" {...register('isActive')} />
            École active
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>{school ? 'Enregistrer' : 'Créer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
