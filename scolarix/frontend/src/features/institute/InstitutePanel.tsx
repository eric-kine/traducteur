import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { instituteSchema, type InstituteInput } from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/common/FormField';
import { applyApiErrors } from '@/lib/form-errors';
import { isAdmin } from '@/lib/permissions';
import { useAuth } from '@/stores/auth.store';
import { useInstitute, useSaveInstitute } from './institute.api';

const FIELDS: { name: keyof InstituteInput; label: string; type?: string; placeholder?: string; wide?: boolean }[] = [
  { name: 'name', label: "Nom de l'institut *", wide: true },
  { name: 'acronym', label: 'Sigle', placeholder: 'ISS' },
  { name: 'directorName', label: 'Directeur / Directrice général(e)' },
  { name: 'address', label: 'Adresse', wide: true },
  { name: 'city', label: 'Ville', placeholder: 'Utilisée dans « Fait à … »' },
  { name: 'country', label: 'Pays' },
  { name: 'phone', label: 'Téléphone', type: 'tel' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'website', label: 'Site web', placeholder: 'https://…' },
  { name: 'logoUrl', label: 'Lien du logo', placeholder: 'https://…/logo.png' },
];

/** Informations générales de l'institut (en-têtes des documents officiels). */
export function InstitutePanel() {
  const user = useAuth((s) => s.user);
  const readOnly = !isAdmin(user);
  const { data: institute, isLoading } = useInstitute();
  const save = useSaveInstitute();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<InstituteInput>({ resolver: zodResolver(instituteSchema) });

  useEffect(() => {
    if (institute !== undefined) {
      reset(Object.fromEntries(FIELDS.map((f) => [f.name, institute?.[f.name] ?? ''])) as InstituteInput);
    }
  }, [institute, reset]);

  const onSubmit = async (values: InstituteInput) => {
    try {
      await save.mutateAsync(values);
      toast.success("Informations de l'institut enregistrées");
    } catch (err) {
      applyApiErrors(err, setError);
    }
  };

  if (isLoading) return <p className="text-muted-foreground">Chargement…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Informations générales</CardTitle>
        <CardDescription>
          {institute === null
            ? "L'institut n'est pas encore configuré : renseignez au moins son nom."
            : 'Ces informations apparaissent en en-tête des relevés et certificats.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.name} className={f.wide ? 'sm:col-span-2' : undefined}>
                <FormField id={`inst-${f.name}`} label={f.label} error={errors[f.name]?.message}>
                  <Input
                    id={`inst-${f.name}`}
                    type={f.type ?? 'text'}
                    placeholder={f.placeholder}
                    aria-invalid={!!errors[f.name]}
                    {...register(f.name)}
                  />
                </FormField>
              </div>
            ))}
          </fieldset>
          {!readOnly && (
            <div className="mt-6 flex justify-end">
              <Button type="submit" disabled={isSubmitting || !isDirty}>Enregistrer</Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
