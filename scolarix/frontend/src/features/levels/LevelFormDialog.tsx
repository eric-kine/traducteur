import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { createLevelSchema, LEVEL_CYCLE_LABELS, LEVEL_CYCLES, type CreateLevelInput, type LevelDto } from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { FormField } from '@/components/common/FormField';
import { applyApiErrors } from '@/lib/form-errors';
import { useSaveLevel } from './levels.api';

export function LevelFormDialog({
  schoolId, open, onClose, level, count,
}: { schoolId: string; open: boolean; onClose: () => void; level?: LevelDto | null; count: number }) {
  const save = useSaveLevel(schoolId);
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<CreateLevelInput>({
    resolver: zodResolver(createLevelSchema),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      level
        ? { code: level.code, name: level.name, cycle: level.cycle, requiredCredits: level.requiredCredits }
        : { code: '', name: '', cycle: 'LICENCE', requiredCredits: 60, order: count + 1 },
    );
  }, [open, level, count, reset]);

  const onSubmit = async (values: CreateLevelInput) => {
    try {
      const { order, ...rest } = values;
      await save.mutateAsync(level ? { ...rest, id: level.id } : values);
      toast.success(level ? 'Niveau modifié' : 'Niveau créé');
      onClose();
    } catch (err) {
      applyApiErrors(err, setError);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{level ? 'Modifier le niveau' : 'Nouveau niveau'}</DialogTitle>
          <DialogDescription>Ex. : N1 – Niveau 1, L3 – Licence 3, M1 – Master 1.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <FormField id="lvl-code" label="Code *" error={errors.code?.message}>
              <Input id="lvl-code" className="uppercase" maxLength={10} placeholder="L1" {...register('code')} />
            </FormField>
            <FormField id="lvl-name" label="Libellé *" error={errors.name?.message}>
              <Input id="lvl-name" placeholder="Licence 1" {...register('name')} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="lvl-cycle" label="Cycle *" error={errors.cycle?.message}>
              <NativeSelect id="lvl-cycle" {...register('cycle')}>
                {LEVEL_CYCLES.map((c) => <option key={c} value={c}>{LEVEL_CYCLE_LABELS[c]}</option>)}
              </NativeSelect>
            </FormField>
            <FormField id="lvl-credits" label="Crédits requis" error={errors.requiredCredits?.message}>
              <Input id="lvl-credits" type="number" min={0} max={300} {...register('requiredCredits')} />
            </FormField>
            {!level && (
              <FormField id="lvl-order" label="Position" error={errors.order?.message}>
                <Input id="lvl-order" type="number" min={1} max={count + 1} {...register('order')} />
              </FormField>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>{level ? 'Enregistrer' : 'Créer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
