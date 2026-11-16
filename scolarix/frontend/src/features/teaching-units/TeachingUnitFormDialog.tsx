import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  computePaidHours,
  createTeachingUnitSchema,
  type CreateTeachingUnitInput,
  type SpecialtyDto,
  type TeachingUnitDto,
} from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/common/FormField';
import { applyApiErrors } from '@/lib/form-errors';
import { useSaveTeachingUnit } from './teaching-units.api';
import { HoursSummary } from './HoursSummary';

const EMPTY: CreateTeachingUnitInput = {
  code: '', title: '', semester: 1, credits: 6, coefficient: 1, specialtyId: '',
  cmHours: 0, tdHours: 0, tpHours: 0, paidHours: '' as unknown as null, hourlyRate: '' as unknown as null,
  ccWeight: 40, examWeight: 60, tpWeight: 0, description: '', objectives: '', prerequisites: '', bibliography: '',
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="space-y-4">
    <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">{title}</legend>
    {children}
  </fieldset>
);

export function TeachingUnitFormDialog({
  levelId, open, onClose, unit, specialties, defaultSemester,
}: {
  levelId: string;
  open: boolean;
  onClose: () => void;
  unit?: TeachingUnitDto | null;
  specialties: SpecialtyDto[];
  defaultSemester?: number;
}) {
  const save = useSaveTeachingUnit(levelId);
  const [paidAuto, setPaidAuto] = useState(true);
  const { register, handleSubmit, reset, watch, setValue, setError, formState: { errors, isSubmitting } } =
    useForm<CreateTeachingUnitInput>({ resolver: zodResolver(createTeachingUnitSchema) });

  useEffect(() => {
    if (!open) return;
    setPaidAuto(unit ? unit.paidHoursAuto : true);
    reset(
      unit
        ? {
            ...EMPTY,
            ...Object.fromEntries(Object.entries(unit).map(([k, v]) => [k, v ?? ''])),
            specialtyId: unit.specialtyId ?? '',
          }
        : { ...EMPTY, semester: defaultSemester ?? 1 },
    );
  }, [open, unit, defaultSemester, reset]);

  const v = watch();

  // En mode automatique, le champ "volume payé" affiche la valeur calculée
  useEffect(() => {
    if (paidAuto) {
      setValue('paidHours', computePaidHours({ cmHours: Number(v.cmHours) || 0, tdHours: Number(v.tdHours) || 0, tpHours: Number(v.tpHours) || 0 }));
    }
  }, [paidAuto, v.cmHours, v.tdHours, v.tpHours, setValue]);

  const onSubmit = async (values: CreateTeachingUnitInput) => {
    try {
      // null = le serveur calcule (et recalculera à chaque changement d'heures)
      await save.mutateAsync({ ...values, paidHours: paidAuto ? null : values.paidHours, id: unit?.id });
      toast.success(unit ? 'UE modifiée' : 'UE créée');
      onClose();
    } catch (err) {
      applyApiErrors(err, setError);
    }
  };

  const num = (name: 'cmHours' | 'tdHours' | 'tpHours' | 'paidHours' | 'hourlyRate' | 'credits' | 'coefficient' | 'ccWeight' | 'examWeight' | 'tpWeight', label: string, step = '0.5', extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <FormField id={`ue-${name}`} label={label} error={errors[name]?.message}>
      <Input id={`ue-${name}`} type="number" inputMode="decimal" min={0} step={step} aria-invalid={!!errors[name]} {...extra} {...register(name)} />
    </FormField>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{unit ? `Modifier ${unit.code}` : 'Nouvelle unité d’enseignement'}</DialogTitle>
          <DialogDescription>Le volume total et le volume payé se calculent pendant la saisie.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
          <Section title="Identification">
            <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
              <FormField id="ue-code" label="Code *" error={errors.code?.message}>
                <Input id="ue-code" className="uppercase" placeholder="INF101" {...register('code')} />
              </FormField>
              <FormField id="ue-title" label="Intitulé *" error={errors.title?.message}>
                <Input id="ue-title" placeholder="Algorithmique et structures de données" {...register('title')} />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <FormField id="ue-semester" label="Semestre *" error={errors.semester?.message}>
                <NativeSelect id="ue-semester" {...register('semester')}>
                  <option value={1}>Semestre 1</option>
                  <option value={2}>Semestre 2</option>
                </NativeSelect>
              </FormField>
              <div className="sm:col-span-1">{num('credits', 'Crédits ECTS *', '1')}</div>
              <div className="sm:col-span-1">{num('coefficient', 'Coefficient *', '0.5')}</div>
              <FormField id="ue-specialty" label="Spécialité" error={errors.specialtyId?.message}>
                <NativeSelect id="ue-specialty" {...register('specialtyId')}>
                  <option value="">Tronc commun</option>
                  {specialties.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                </NativeSelect>
              </FormField>
            </div>
          </Section>

          <Section title="Quotas horaires">
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {num('cmHours', 'Heures CM')}
                  {num('tdHours', 'Heures TD')}
                  {num('tpHours', 'Heures TP')}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    {num('paidHours', 'Volume horaire payé', '0.5', { readOnly: paidAuto, className: paidAuto ? 'bg-muted' : undefined })}
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4" checked={paidAuto} onChange={(e) => setPaidAuto(e.target.checked)} />
                      Calcul automatique (équivalent TD)
                    </label>
                  </div>
                  {num('hourlyRate', 'Taux horaire', '100', { placeholder: 'ex. 10000' })}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Pondération des notes (%)</p>
                  <div className="grid grid-cols-3 gap-4">
                    {num('ccWeight', 'Contrôle continu', '5')}
                    {num('examWeight', 'Examen', '5')}
                    {num('tpWeight', 'Note de TP', '5')}
                  </div>
                </div>
              </div>
              <HoursSummary {...v} paidAuto={paidAuto} />
            </div>
          </Section>

          <Section title="Contenu pédagogique (repris dans le syllabus)">
            <FormField id="ue-objectives" label="Objectifs pédagogiques" error={errors.objectives?.message}>
              <Textarea id="ue-objectives" rows={3} placeholder="À l'issue de cette UE, l'étudiant sera capable de…" {...register('objectives')} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="ue-prerequisites" label="Prérequis" error={errors.prerequisites?.message}>
                <Textarea id="ue-prerequisites" rows={3} {...register('prerequisites')} />
              </FormField>
              <FormField id="ue-bibliography" label="Bibliographie" error={errors.bibliography?.message}>
                <Textarea id="ue-bibliography" rows={3} placeholder="Une référence par ligne" {...register('bibliography')} />
              </FormField>
            </div>
            <FormField id="ue-description" label="Description courte" error={errors.description?.message}>
              <Textarea id="ue-description" rows={2} {...register('description')} />
            </FormField>
          </Section>

          <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>{unit ? 'Enregistrer' : 'Créer l’UE'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
