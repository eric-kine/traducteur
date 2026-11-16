import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createAcademicYearSchema, type AcademicYearDto, type CreateAcademicYearInput } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { FormField } from '@/components/common/FormField';
import { applyApiErrors } from '@/lib/form-errors';
import { isAdmin } from '@/lib/permissions';
import { useAuth } from '@/stores/auth.store';
import { useAcademicYears, useDeleteAcademicYear, useSaveAcademicYear } from './academic-years.api';

const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { timeZone: 'UTC' });

function YearFormDialog({ open, onClose, year, hasCurrent }: { open: boolean; onClose: () => void; year?: AcademicYearDto | null; hasCurrent: boolean }) {
  const save = useSaveAcademicYear();
  const { register, handleSubmit, reset, setError, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<CreateAcademicYearInput>({ resolver: zodResolver(createAcademicYearSchema) });

  useEffect(() => {
    if (!open) return;
    const y = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    reset(year ?? { label: `${y}-${y + 1}`, startDate: `${y}-09-01`, endDate: `${y + 1}-07-31`, isCurrent: !hasCurrent });
  }, [open, year, reset, hasCurrent]);

  // Proposition automatique des dates quand on tape le libellé (ex. 2027-2028)
  const label = watch('label');
  useEffect(() => {
    if (!year && /^\d{4}-\d{4}$/.test(label ?? '')) {
      setValue('startDate', `${label.slice(0, 4)}-09-01`);
      setValue('endDate', `${label.slice(5)}-07-31`);
    }
  }, [label, year, setValue]);

  const onSubmit = async (v: CreateAcademicYearInput) => {
    try {
      await save.mutateAsync({ ...v, id: year?.id });
      toast.success('Année enregistrée');
      onClose();
    } catch (e) {
      applyApiErrors(e, setError);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{year ? "Modifier l'année" : 'Nouvelle année académique'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField id="ay-label" label="Libellé *" error={errors.label?.message}>
            <Input id="ay-label" placeholder="2026-2027" {...register('label')} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="ay-start" label="Début *" error={errors.startDate?.message}>
              <Input id="ay-start" type="date" {...register('startDate')} />
            </FormField>
            <FormField id="ay-end" label="Fin *" error={errors.endDate?.message}>
              <Input id="ay-end" type="date" {...register('endDate')} />
            </FormField>
          </div>
          {!year?.isCurrent && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" {...register('isCurrent')} /> Définir comme année courante
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AcademicYearsPanel() {
  const admin = isAdmin(useAuth((s) => s.user));
  const { data, isLoading } = useAcademicYears();
  const save = useSaveAcademicYear();
  const del = useDeleteAcademicYear();
  const [form, setForm] = useState<{ open: boolean; year?: AcademicYearDto | null }>({ open: false });
  const [toDelete, setToDelete] = useState<AcademicYearDto | null>(null);
  const add = admin && <Button onClick={() => setForm({ open: true })}><Plus /> Nouvelle année</Button>;

  return (
    <Card>
      <div className="flex items-center justify-between border-b p-4">
        <p className="text-sm text-muted-foreground">L'année courante est proposée par défaut dans les inscriptions et affectations.</p>
        {!!data?.length && add}
      </div>
      {isLoading ? <p className="p-6 text-muted-foreground">Chargement…</p> : !data?.length ? (
        <EmptyState icon={CalendarDays} title="Aucune année académique" text="Créez l'année en cours (ex. 2026-2027) avant d'inscrire des étudiants." action={add} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Année</TableHead>
              <TableHead>Période</TableHead>
              <TableHead className="hidden text-center sm:table-cell">Inscriptions</TableHead>
              <TableHead className="hidden text-center sm:table-cell">Affectations</TableHead>
              {admin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((y) => (
              <TableRow key={y.id}>
                <TableCell className="font-medium">
                  {y.label} {y.isCurrent && <Badge variant="success" className="ml-2">Courante</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground">{fmt(y.startDate)} → {fmt(y.endDate)}</TableCell>
                <TableCell className="hidden text-center sm:table-cell">{y._count?.enrollments ?? 0}</TableCell>
                <TableCell className="hidden text-center sm:table-cell">{y._count?.assignments ?? 0}</TableCell>
                {admin && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {!y.isCurrent && (
                        <Button variant="ghost" size="icon" title="Définir comme année courante"
                          onClick={() => save.mutate({ id: y.id, isCurrent: true }, { onSuccess: () => toast.success(`${y.label} est l'année courante`) })}>
                          <Star />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" title="Modifier" onClick={() => setForm({ open: true, year: y })}><Pencil /></Button>
                      <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setToDelete(y)}><Trash2 className="text-destructive" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <YearFormDialog open={form.open} year={form.year} hasCurrent={!!data?.some((y) => y.isCurrent)} onClose={() => setForm({ open: false })} />
      <ConfirmDialog open={!!toDelete} title={`Supprimer l'année ${toDelete?.label} ?`}
        description="Impossible si des inscriptions, affectations ou emplois du temps y sont rattachés."
        onConfirm={() => del.mutateAsync(toDelete!.id)} onClose={() => setToDelete(null)} />
    </Card>
  );
}
