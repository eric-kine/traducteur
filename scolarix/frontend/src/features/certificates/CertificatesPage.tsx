import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, Ban, Copy, Eye, FileBadge, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { ENROLLMENT_STATUS_LABELS, type CertificateDto, type StudentDto } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { FormField } from '@/components/common/FormField';
import { cn, formatDateTime } from '@/lib/utils';
import { useAcademicYears } from '../academic-years/academic-years.api';
import { useStudent, useStudentEnrollments, useStudents } from '../students/students.api';
import { openDuplicate, previewCertificate, useCertificates, useIssueCertificate, useRevokeCertificate, type CertificateFilters } from './certificates.api';

const PURPOSES = ['Demande de bourse', 'Stage', 'Demande de visa', 'Allocations familiales', 'Transport / réduction'];
const ELIGIBLE = ['INSCRIT', 'ADMIS', 'AJOURNE'];

/** Bloc "Émettre un certificat" : étudiant → inscription → motif → aperçu / émission. */
function IssuePanel({ initialStudentId, initialYear }: { initialStudentId?: string; initialYear?: string }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [studentId, setStudentId] = useState(initialStudentId ?? '');
  const [year, setYear] = useState(initialYear ?? '');
  const [purpose, setPurpose] = useState('');
  const { data: found } = useStudents({ search: debounced, page: 1 });
  const { data: student } = useStudent(studentId);
  const { data: enrollments = [] } = useStudentEnrollments(studentId);
  const issue = useIssueCertificate();

  useEffect(() => { const t = setTimeout(() => setDebounced(query.trim()), 250); return () => clearTimeout(t); }, [query]);
  useEffect(() => {
    if (!year && enrollments.length) setYear(enrollments.find((e) => ELIGIBLE.includes(e.status))?.academicYear.label ?? '');
  }, [enrollments, year]);

  const pick = (s: StudentDto) => { setStudentId(s.id); setYear(''); setQuery(''); };
  const chosen = enrollments.find((e) => e.academicYear.label === year);
  const eligible = !!chosen && ELIGIBLE.includes(chosen.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><FileBadge className="h-5 w-5 text-primary" /> Émettre un certificat de scolarité</CardTitle>
        <CardDescription>Chaque émission reçoit un numéro d'ordre (CS-année-numéro) et un QR code de vérification.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!studentId || !student ? (
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Rechercher l'étudiant (nom, prénom, matricule)…" aria-label="Rechercher l'étudiant" value={query} onChange={(e) => setQuery(e.target.value)} />
            {debounced.length >= 2 && (
              <ul role="listbox" className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-background shadow-lg">
                {!found?.data.length && <li className="p-3 text-sm text-muted-foreground">Aucun étudiant trouvé.</li>}
                {found?.data.slice(0, 8).map((s) => (
                  <li key={s.id}>
                    <button type="button" role="option" aria-selected="false" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => pick(s)}>
                      <span><b>{s.lastName.toUpperCase()} {s.firstName}</b> <span className="font-mono text-xs text-muted-foreground">{s.matricule}</span></span>
                      <span className="text-xs text-muted-foreground">{s.school.code}{s.currentEnrollment && ` · ${s.currentEnrollment.level.code}`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
              <div>
                <p className="font-medium">{student.lastName.toUpperCase()} {student.firstName}</p>
                <p className="text-sm text-muted-foreground"><span className="font-mono">{student.matricule}</span> · {student.school.name}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setStudentId(''); setYear(''); }}><X /> Changer</Button>
            </div>

            {!enrollments.length ? (
              <p className="text-sm text-destructive">Cet étudiant n'a aucune inscription : inscrivez-le d'abord depuis sa fiche.</p>
            ) : (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Année d'inscription</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {enrollments.map((e) => {
                    const ok = ELIGIBLE.includes(e.status);
                    return (
                      <label key={e.id} className={cn('flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm', year === e.academicYear.label && 'border-primary bg-primary/5', !ok && 'cursor-not-allowed opacity-60')}>
                        <input type="radio" name="year" disabled={!ok} checked={year === e.academicYear.label} onChange={() => setYear(e.academicYear.label)} />
                        <span>
                          <b>{e.academicYear.label}</b> — {e.level.name}{e.specialty && ` · ${e.specialty.code}`}
                          <span className="block text-xs text-muted-foreground">{ENROLLMENT_STATUS_LABELS[e.status]}{!ok && ' : certificat impossible'}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <FormField id="purpose" label="Motif (facultatif, imprimé sur le certificat)">
              <Input id="purpose" list="purposes" maxLength={150} placeholder="ex. Demande de bourse" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              <datalist id="purposes">{PURPOSES.map((p) => <option key={p} value={p} />)}</datalist>
            </FormField>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={!eligible} onClick={() => previewCertificate(studentId, year, purpose)}><Eye /> Aperçu</Button>
              <Button disabled={!eligible || issue.isPending}
                onClick={() => issue.mutate({ studentId, year, purpose }, { onSuccess: () => toast.success('Certificat émis et enregistré dans l’historique') })}>
                <Award /> Émettre le certificat (PDF)
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RevokeDialog({ cert, onClose }: { cert: CertificateDto | null; onClose: () => void }) {
  const revoke = useRevokeCertificate();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setReason(''); setError(null); }, [cert]);
  return (
    <Dialog open={!!cert} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler le certificat {cert?.number} ?</DialogTitle>
          <DialogDescription>Il reste dans l'historique, mais la vérification en ligne indiquera qu'il est annulé. Cette action est définitive.</DialogDescription>
        </DialogHeader>
        <FormField id="reason" label="Motif de l'annulation *" error={error ?? undefined}>
          <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex. Émis par erreur (mauvaise année)" />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Retour</Button>
          <Button variant="destructive" disabled={revoke.isPending}
            onClick={() => revoke.mutate({ id: cert!.id, reason }, {
              onSuccess: () => { toast.success('Certificat annulé'); onClose(); },
              onError: (e) => setError(e.message),
            })}>Annuler le certificat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CertificatesPage() {
  const [params] = useSearchParams();
  const { data: years = [] } = useAcademicYears();
  const [f, setF] = useState<CertificateFilters>({ page: 1 });
  const [search, setSearch] = useState('');
  const { data, isLoading } = useCertificates(f);
  const [toRevoke, setToRevoke] = useState<CertificateDto | null>(null);
  useEffect(() => { const t = setTimeout(() => setF((x) => ({ ...x, search, page: 1 })), 300); return () => clearTimeout(t); }, [search]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Certificats de scolarité</h1>
        <p className="text-muted-foreground">Émission, duplicata, annulation et historique</p>
      </div>

      <IssuePanel initialStudentId={params.get('student') ?? undefined} initialYear={params.get('year') ?? undefined} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">Historique {data && <span className="text-sm font-normal text-muted-foreground">({data.total})</span>}</h2>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[260px_160px_150px]">
          <Input placeholder="N°, nom, matricule…" aria-label="Rechercher dans l'historique" value={search} onChange={(e) => setSearch(e.target.value)} />
          <NativeSelect aria-label="Année" value={f.academicYearId ?? ''} onChange={(e) => setF((x) => ({ ...x, academicYearId: e.target.value, page: 1 }))}>
            <option value="">Toutes les années</option>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Statut" value={f.status ?? ''} onChange={(e) => setF((x) => ({ ...x, status: e.target.value, page: 1 }))}>
            <option value="">Tous</option>
            <option value="VALIDE">Valides</option>
            <option value="ANNULE">Annulés</option>
          </NativeSelect>
        </div>
      </div>

      <Card>
        {isLoading ? <p className="p-6 text-muted-foreground">Chargement…</p> : !data?.data.length ? (
          <EmptyState icon={FileBadge} title="Aucun certificat" text="Les certificats émis apparaîtront ici." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Étudiant</TableHead>
                  <TableHead className="hidden md:table-cell">Inscription</TableHead>
                  <TableHead className="hidden lg:table-cell">Émis le / par</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((c) => (
                  <TableRow key={c.id} className={c.status === 'ANNULE' ? 'opacity-60' : ''}>
                    <TableCell className="font-mono text-sm">{c.number}</TableCell>
                    <TableCell>
                      <p className="font-medium">{c.student.lastName.toUpperCase()} {c.student.firstName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{c.student.matricule}</p>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">
                      {c.academicYear} · {c.school.code} · {c.level}{c.specialty && ` · ${c.specialty}`}
                      {c.purpose && <p className="text-xs text-muted-foreground">Motif : {c.purpose}</p>}
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{formatDateTime(c.issuedAt)}<p className="text-xs text-muted-foreground">{c.issuedBy ?? '—'}</p></TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'VALIDE' ? 'success' : 'destructive'}>{c.status === 'VALIDE' ? 'Valide' : 'Annulé'}</Badge>
                      {c.revokedReason && <p className="mt-1 max-w-[180px] text-xs text-muted-foreground">{c.revokedReason}</p>}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Duplicata (PDF)" onClick={() => openDuplicate(c)}><Copy /></Button>
                        {c.status === 'VALIDE' && <Button variant="ghost" size="icon" title="Annuler le certificat" onClick={() => setToRevoke(c)}><Ban className="text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-end gap-2 border-t p-4 text-sm text-muted-foreground">
              <Button variant="outline" size="sm" disabled={f.page <= 1} onClick={() => setF((x) => ({ ...x, page: x.page - 1 }))}>Précédent</Button>
              <span>Page {f.page} / {pages}</span>
              <Button variant="outline" size="sm" disabled={f.page >= pages} onClick={() => setF((x) => ({ ...x, page: x.page + 1 }))}>Suivant</Button>
            </div>
          </>
        )}
      </Card>
      <RevokeDialog cert={toRevoke} onClose={() => setToRevoke(null)} />
    </div>
  );
}
