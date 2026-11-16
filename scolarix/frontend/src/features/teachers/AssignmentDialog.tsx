import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { formatHours, SESSION_TYPES, type AssignmentDto, type SessionType } from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { FormField } from '@/components/common/FormField';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSchools } from '../schools/schools.api';
import { useLevels } from '../levels/levels.api';
import { useTeachingUnits } from '../teaching-units/teaching-units.api';
import { useCoverage, useSaveAssignment } from './teachers.api';

/**
 * Affecter un enseignant à une UE pour une année : école → niveau → UE → type.
 * Le reste disponible (quota − déjà affecté) est affiché en direct.
 */
export function AssignmentDialog({
  open, onClose, teacherId, academicYearId, yearLabel, assignment,
}: { open: boolean; onClose: () => void; teacherId: string; academicYearId: string; yearLabel: string; assignment?: AssignmentDto | null }) {
  const save = useSaveAssignment();
  const { data: schools = [] } = useSchools({ isActive: 'true' });
  const [schoolId, setSchoolId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [type, setType] = useState<SessionType>('CM');
  const [assigned, setAssigned] = useState('');
  const [completed, setCompleted] = useState('0');
  const [coordinator, setCoordinator] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { data: levels = [] } = useLevels(schoolId);
  const { data: units } = useTeachingUnits(levelId);
  const { data: coverage } = useCoverage(assignment?.teachingUnit.id ?? unitId, academicYearId);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (assignment) {
      setSchoolId(assignment.teachingUnit.level.school.id);
      setLevelId(assignment.teachingUnit.level.id);
      setUnitId(assignment.teachingUnit.id);
      setType(assignment.sessionType);
      setAssigned(String(assignment.assignedHours));
      setCompleted(String(assignment.completedHours));
      setCoordinator(assignment.isCoordinator);
    } else {
      setSchoolId(schools.length === 1 ? schools[0]!.id : '');
      setLevelId(''); setUnitId(''); setType('CM'); setAssigned(''); setCompleted('0'); setCoordinator(false);
    }
  }, [open, assignment]); // eslint-disable-line react-hooks/exhaustive-deps

  const cov = coverage?.byType[type];
  // En modification, les heures de cette affectation sont déjà comptées dans "assigned"
  const available = cov ? cov.remaining + (assignment ? assignment.assignedHours : 0) : null;

  // Propose automatiquement le reste disponible
  useEffect(() => {
    if (!assignment && available !== null && available > 0 && !assigned) setAssigned(String(available));
  }, [available]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setErrors({});
    try {
      if (assignment) {
        await save.mutateAsync({ id: assignment.id, assignedHours: Number(assigned), completedHours: Number(completed), isCoordinator: coordinator });
      } else {
        await save.mutateAsync({ teacherId, teachingUnitId: unitId, academicYearId, sessionType: type, assignedHours: Number(assigned), completedHours: Number(completed), isCoordinator: coordinator });
      }
      toast.success('Affectation enregistrée');
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(Object.fromEntries(Object.entries(e.details).map(([k, v]) => [k, v[0]!])));
      else toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const locked = !!assignment;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{assignment ? `Affectation ${assignment.teachingUnit.code} — ${assignment.sessionType}` : 'Nouvelle affectation'}</DialogTitle>
          <DialogDescription>Année {yearLabel}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="as-school" label="École *">
              <NativeSelect id="as-school" value={schoolId} disabled={locked} onChange={(e) => { setSchoolId(e.target.value); setLevelId(''); setUnitId(''); }}>
                <option value="">—</option>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </NativeSelect>
            </FormField>
            <FormField id="as-level" label="Niveau *">
              <NativeSelect id="as-level" value={levelId} disabled={locked || !schoolId} onChange={(e) => { setLevelId(e.target.value); setUnitId(''); }}>
                <option value="">—</option>
                {levels.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
              </NativeSelect>
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <FormField id="as-unit" label="Unité d'enseignement *" error={errors.teachingUnitId}>
              <NativeSelect id="as-unit" value={unitId} disabled={locked || !levelId} onChange={(e) => { setUnitId(e.target.value); setAssigned(''); }}>
                <option value="">—</option>
                {units?.data.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.title} (S{u.semester})</option>)}
              </NativeSelect>
            </FormField>
            <FormField id="as-type" label="Type *" error={errors.sessionType}>
              <NativeSelect id="as-type" value={type} disabled={locked} onChange={(e) => { setType(e.target.value as SessionType); setAssigned(''); }}>
                {SESSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </NativeSelect>
            </FormField>
          </div>

          {cov && (
            <div className={cn('rounded-md border p-3 text-sm', available === 0 ? 'border-amber-300 bg-amber-50' : 'bg-muted/40')} aria-live="polite">
              Quota {type} de l'UE : <strong>{formatHours(cov.quota)}</strong> · déjà affecté : {formatHours(cov.assigned)} ·{' '}
              disponible pour cette affectation : <strong>{formatHours(available ?? 0)}</strong>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="as-assigned" label="Heures prévues *" error={errors.assignedHours}>
              <Input id="as-assigned" type="number" min={0} step={0.5} value={assigned} onChange={(e) => setAssigned(e.target.value)} />
            </FormField>
            <FormField id="as-completed" label="Heures assurées" error={errors.completedHours}>
              <Input id="as-completed" type="number" min={0} step={0.5} value={completed} onChange={(e) => setCompleted(e.target.value)} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={coordinator} onChange={(e) => setCoordinator(e.target.checked)} />
            Responsable de l'UE (un seul par UE et par année)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={save.isPending || !unitId || !assigned}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
