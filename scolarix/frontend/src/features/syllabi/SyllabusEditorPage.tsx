import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Eye, FileDown, Plus, Save, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { evaluationSummary, formatHours, saveSyllabusSchema, SESSION_TYPES, type SaveSyllabusInput, type SyllabusDto } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/common/FormField';
import { ApiError } from '@/lib/api';
import { applyApiErrors } from '@/lib/form-errors';
import { cn, formatDateTime } from '@/lib/utils';
import { useAcademicYears, useCurrentYear } from '../academic-years/academic-years.api';
import { openSyllabus, useSaveSyllabus, useSyllabus } from './syllabi.api';

/** Valeurs du formulaire : les champs vides sont pré-remplis avec le texte de l'UE. */
const toForm = (s: SyllabusDto): SaveSyllabusInput => ({
  year: s.academicYear.label,
  status: s.status === 'PUBLIE' ? 'PUBLIE' : 'BROUILLON',
  objectives: s.fields.objectives ?? s.teachingUnit.objectives ?? '',
  competencies: s.fields.competencies ?? '',
  prerequisites: s.fields.prerequisites ?? s.teachingUnit.prerequisites ?? '',
  content: s.fields.content.map((c) => ({ title: c.title, sessionType: c.sessionType ?? '', hours: (c.hours ?? '') as number, description: c.description ?? '' })) as SaveSyllabusInput['content'],
  teachingMethods: s.fields.teachingMethods ?? '',
  evaluationMethods: s.fields.evaluationMethods ?? '',
  bibliography: s.fields.bibliography ?? s.teachingUnit.bibliography ?? '',
});

export function SyllabusEditorPage() {
  const { unitId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data: years = [] } = useAcademicYears();
  const current = useCurrentYear();
  const year = params.get('year') ?? current?.label ?? '';
  const { data: s, error } = useSyllabus(unitId, year);
  const save = useSaveSyllabus(unitId);
  const form = useForm<SaveSyllabusInput>({ resolver: zodResolver(saveSyllabusSchema) });
  const { register, handleSubmit, reset, control, watch, setError, formState: { errors, isSubmitting, isDirty } } = form;
  const chapters = useFieldArray({ control, name: 'content' });

  useEffect(() => { if (s) reset(toForm(s)); }, [s, reset]);

  if (error instanceof ApiError) return <p className="text-destructive">{error.message}</p>;
  if (!s) return <p className="text-muted-foreground">Chargement…</p>;
  const u = s.teachingUnit;
  const readOnly = !s.canEdit;

  // Heures prévues dans le contenu, par type, comparées au volume de l'UE
  const content = watch('content') ?? [];
  const planned = { CM: 0, TD: 0, TP: 0, '': 0 } as Record<string, number>;
  for (const c of content) planned[(c.sessionType as string) || ''] += Number(c.hours) || 0;
  const quota = { CM: u.cmHours, TD: u.tdHours, TP: u.tpHours };

  const onSubmit = async (v: SaveSyllabusInput) => {
    try {
      await save.mutateAsync(v);
      toast.success('Syllabus enregistré');
    } catch (e) {
      applyApiErrors(e, setError);
    }
  };
  const err = (path: string) => (errors as Record<string, { message?: string }>)[path]?.message;
  const chapterErr = (i: number, k: string) => (errors.content?.[i] as Record<string, { message?: string }> | undefined)?.[k]?.message;

  const area = (name: 'objectives' | 'competencies' | 'prerequisites' | 'teachingMethods' | 'evaluationMethods' | 'bibliography', label: string, placeholder: string, rows = 4) => (
    <FormField id={`sy-${name}`} label={label} error={err(name)}>
      <Textarea id={`sy-${name}`} rows={rows} placeholder={placeholder} disabled={readOnly} {...register(name)} />
    </FormField>
  );

  return (
    <div className="space-y-6">
      <Link to={`/admin/levels/${s.level.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Maquette {s.level.code}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Syllabus · {s.school.code} · {s.level.name}{s.specialty ? ` · ${s.specialty.code}` : ''}</p>
          <h1 className="text-2xl font-bold"><span className="font-mono">{u.code}</span> — {u.title}</h1>
          <p className="text-sm text-muted-foreground">
            {s.exists ? <>Mis à jour {formatDateTime(s.updatedAt)}{s.updatedBy && ` par ${s.updatedBy}`}</> : 'Pas encore rédigé : les champs sont pré-remplis avec les informations de l’UE.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NativeSelect aria-label="Année académique" className="w-36" value={year} onChange={(e) => setParams({ year: e.target.value })}>
            {years.map((y) => <option key={y.id} value={y.label}>{y.label}</option>)}
          </NativeSelect>
          <Button variant="outline" onClick={() => openSyllabus(unitId, year, 'html')}><Eye /> Aperçu</Button>
          <Button variant="outline" onClick={() => openSyllabus(unitId, year, 'pdf')}><FileDown /> PDF</Button>
          {!readOnly && <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting || !isDirty}><Save /> Enregistrer</Button>}
        </div>
      </div>
      {readOnly && <p className="rounded-md border bg-muted/40 p-3 text-sm">Lecture seule : seuls l'administration, la scolarité de l'école et le responsable de l'UE peuvent modifier ce syllabus.</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Objectifs, compétences, prérequis</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {area('objectives', 'Objectifs pédagogiques', "À l'issue de l'UE, l'étudiant sera capable de…\n- …")}
              {area('competencies', 'Compétences visées', '- Une compétence par ligne', 3)}
              {area('prerequisites', 'Prérequis', 'Connaissances nécessaires pour suivre l’UE', 2)}
              <p className="text-xs text-muted-foreground">Astuce : commencez une ligne par « - » pour créer une liste à puces dans le PDF.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Contenu détaillé</CardTitle>
              {!readOnly && (
                <Button type="button" size="sm" variant="outline" onClick={() => chapters.append({ title: '', sessionType: 'CM', hours: '' as unknown as number, description: '' })}>
                  <Plus /> Ajouter un chapitre
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {!chapters.fields.length && <p className="text-sm text-muted-foreground">Aucun chapitre. Ajoutez les séquences du cours (titre, type, durée).</p>}
              {chapters.fields.map((field, i) => (
                <div key={field.id} className="rounded-md border p-3">
                  <div className="grid gap-3 sm:grid-cols-[32px_1fr_130px_100px_auto] sm:items-start">
                    <span className="pt-2 text-sm font-semibold text-muted-foreground">{i + 1}.</span>
                    <FormField id={`ch-${i}-title`} label="Titre" error={chapterErr(i, 'title')}>
                      <Input id={`ch-${i}-title`} disabled={readOnly} {...register(`content.${i}.title`)} />
                    </FormField>
                    <FormField id={`ch-${i}-type`} label="Type" error={chapterErr(i, 'sessionType')}>
                      <NativeSelect id={`ch-${i}-type`} disabled={readOnly} {...register(`content.${i}.sessionType`)}>
                        <option value="">—</option>
                        {SESSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </NativeSelect>
                    </FormField>
                    <FormField id={`ch-${i}-hours`} label="Heures" error={chapterErr(i, 'hours')}>
                      <Input id={`ch-${i}-hours`} type="number" min={0} step={0.5} disabled={readOnly} {...register(`content.${i}.hours`)} />
                    </FormField>
                    {!readOnly && (
                      <div className="flex gap-1 sm:pt-7">
                        <Button type="button" variant="ghost" size="icon" title="Monter" disabled={i === 0} onClick={() => chapters.move(i, i - 1)}><ArrowUp /></Button>
                        <Button type="button" variant="ghost" size="icon" title="Descendre" disabled={i === chapters.fields.length - 1} onClick={() => chapters.move(i, i + 1)}><ArrowDown /></Button>
                        <Button type="button" variant="ghost" size="icon" title="Supprimer le chapitre" onClick={() => chapters.remove(i)}><Trash2 className="text-destructive" /></Button>
                      </div>
                    )}
                  </div>
                  <Textarea className="mt-2" rows={2} aria-label={`Description du chapitre ${i + 1}`} placeholder="Description (facultatif)" disabled={readOnly} {...register(`content.${i}.description`)} />
                </div>
              ))}
              {chapters.fields.length > 0 && (
                <div className="flex flex-wrap gap-2 text-sm" aria-live="polite">
                  {(['CM', 'TD', 'TP'] as const).filter((t) => quota[t] > 0 || planned[t]! > 0).map((t) => (
                    <Badge key={t} variant={planned[t] === quota[t] ? 'success' : planned[t]! > quota[t] ? 'destructive' : 'secondary'}>
                      {t} : {formatHours(planned[t]!)} / {formatHours(quota[t])}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Méthodes, évaluation, bibliographie</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {area('teachingMethods', 'Méthodes pédagogiques', 'Cours magistraux, études de cas, projet en équipe, plateforme en ligne…', 3)}
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="mb-1 font-medium">Modalités d'évaluation (générées depuis les pondérations de l'UE)</p>
                <ul className="list-disc pl-5 text-muted-foreground">{evaluationSummary(u).map((l) => <li key={l}>{l}</li>)}</ul>
              </div>
              {area('evaluationMethods', "Précisions sur l'évaluation (facultatif)", 'Nature du contrôle continu, durée de l’examen, documents autorisés…', 3)}
              {area('bibliography', 'Bibliographie (une référence par ligne)', 'Auteur, Titre, Éditeur, Année', 4)}
            </CardContent>
          </Card>

          {!readOnly && (
            <div className="flex items-center justify-between rounded-md border p-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4"
                  checked={watch('status') === 'PUBLIE'}
                  onChange={(e) => form.setValue('status', e.target.checked ? 'PUBLIE' : 'BROUILLON', { shouldDirty: true })} />
                Publié (sinon la mention « BROUILLON » apparaît sur le PDF)
              </label>
              <Button type="submit" disabled={isSubmitting || !isDirty}><Save /> Enregistrer</Button>
            </div>
          )}
        </form>

        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Informations de l'UE</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Semestre :</span> {u.semester}</p>
              <p><span className="text-muted-foreground">Crédits ECTS :</span> {u.credits} · coef. {u.coefficient}</p>
              <p><span className="text-muted-foreground">Volume :</span> CM {u.cmHours} · TD {u.tdHours} · TP {u.tpHours} = <b>{formatHours(u.totalHours)}</b></p>
              <p className="pt-2 text-xs text-muted-foreground">Ces informations se modifient dans la maquette du niveau.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Enseignants ({s.academicYear.label})</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!s.teachers.length && <p className="text-muted-foreground">Aucun enseignant affecté. Affectez-les depuis la fiche enseignant.</p>}
              {s.teachers.map((t) => (
                <div key={t.email} className={cn('rounded-md border p-2', t.isCoordinator && 'border-primary bg-primary/5')}>
                  <p className="font-medium">{t.title} {t.lastName.toUpperCase()} {t.firstName}{t.isCoordinator && <Star className="ml-1 inline h-3.5 w-3.5 text-primary" />}</p>
                  <p className="text-xs text-muted-foreground">{t.isCoordinator ? 'Responsable · ' : ''}{t.sessionTypes.join(', ')} · {t.email}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
