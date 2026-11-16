import type { UseFormRegisterReturn } from 'react-hook-form';
import { NativeSelect } from '@/components/ui/select';
import { FormField } from '@/components/common/FormField';
import { useAcademicYears } from '../academic-years/academic-years.api';
import { useLevels } from '../levels/levels.api';
import { useSpecialties } from '../specialties/specialties.api';

/** Trois listes liées : année, niveau et spécialité de l'école choisie. */
export function EnrollmentSelects({
  schoolId, year, level, specialty, errors = {}, prefix,
}: {
  schoolId: string;
  year?: UseFormRegisterReturn;
  level: UseFormRegisterReturn;
  specialty: UseFormRegisterReturn;
  errors?: Partial<Record<'academicYearId' | 'levelId' | 'specialtyId', string>>;
  prefix: string;
}) {
  const { data: years = [] } = useAcademicYears();
  const { data: levels = [] } = useLevels(schoolId);
  const { data: specialties = [] } = useSpecialties(schoolId);
  return (
    <div className={`grid gap-4 ${year ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {year && (
        <FormField id={`${prefix}-year`} label="Année *" error={errors.academicYearId}>
          <NativeSelect id={`${prefix}-year`} {...year}>
            <option value="">—</option>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.isCurrent ? ' (courante)' : ''}</option>)}
          </NativeSelect>
        </FormField>
      )}
      <FormField id={`${prefix}-level`} label="Niveau *" error={errors.levelId}>
        <NativeSelect id={`${prefix}-level`} disabled={!schoolId} {...level}>
          <option value="">—</option>
          {levels.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
        </NativeSelect>
      </FormField>
      <FormField id={`${prefix}-specialty`} label="Spécialité" error={errors.specialtyId}>
        <NativeSelect id={`${prefix}-specialty`} disabled={!schoolId} {...specialty}>
          <option value="">Tronc commun / aucune</option>
          {specialties.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </NativeSelect>
      </FormField>
    </div>
  );
}
