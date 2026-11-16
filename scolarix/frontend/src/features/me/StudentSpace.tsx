import { useState } from 'react';
import { Award, CalendarRange, FileDown, GraduationCap, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { DECISION_LABELS, ENROLLMENT_STATUS_LABELS, formatScore, UE_STATUS_LABELS } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDateTime } from '@/lib/utils';
import { openDocument } from '@/lib/open-document';
import { useQueryClient } from '@tanstack/react-query';
import { TimetableGrid } from '../schedules/TimetableGrid';
import { StudentAvatar } from '../students/StudentAvatar';
import { useMyCertificates, useMyResults, useMyTimetable, useStudentSpace } from './me.api';

type Tab = 'grades' | 'documents' | 'timetable';
const STATUS_VARIANT = { V: 'success', VC: 'default', NV: 'destructive', INC: 'muted' } as const;

function Grades({ years }: { years: { label: string; deliberated: boolean }[] }) {
  const [year, setYear] = useState(years[0]?.label ?? '');
  const { data: r, isLoading } = useMyResults(year);
  const meta = years.find((y) => y.label === year);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect aria-label="Année" className="w-40" value={year} onChange={(e) => setYear(e.target.value)}>
          {years.map((y) => <option key={y.label} value={y.label}>{y.label}</option>)}
        </NativeSelect>
        {meta?.deliberated
          ? <Button variant="outline" onClick={() => openDocument(`/me/transcript?year=${year}`, `releve-${year}.pdf`)}><FileDown /> Relevé de notes officiel (PDF)</Button>
          : <span className="text-sm text-muted-foreground">Notes provisoires : le relevé officiel sera disponible après la délibération.</span>}
      </div>
      {isLoading || !r ? <p className="text-muted-foreground">Chargement…</p> : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              ['Moyenne annuelle', `${formatScore(r.year.average)} / 20`],
              ['Crédits acquis', `${r.year.creditsEarned} / ${r.year.totalCredits}`],
              ['Mention', r.year.mention ?? '—'],
              ['Décision', r.deliberatedAt ? DECISION_LABELS[r.year.decision] : 'En attente de délibération'],
            ].map(([k, v]) => <Card key={k} className="p-4"><p className="text-xs uppercase text-muted-foreground">{k}</p><p className="mt-1 text-lg font-semibold">{v}</p></Card>)}
          </div>
          {r.semesters.map((s) => (
            <Card key={s.number}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Semestre {s.number}</CardTitle>
                <span className="text-sm">Moyenne <b>{formatScore(s.average)}</b> · {s.creditsEarned}/{s.totalCredits} crédits</span>
              </CardHeader>
              <Table>
                <TableHeader><TableRow><TableHead>UE</TableHead><TableHead className="text-center">Crédits</TableHead><TableHead className="hidden text-center sm:table-cell">CC</TableHead><TableHead className="hidden text-center sm:table-cell">Examen</TableHead><TableHead className="text-center">Note</TableHead><TableHead>Résultat</TableHead></TableRow></TableHeader>
                <TableBody>
                  {s.units.map((u) => (
                    <TableRow key={u.code}>
                      <TableCell><span className="font-mono text-xs">{u.code}</span> {u.title}</TableCell>
                      <TableCell className="text-center">{u.credits}</TableCell>
                      <TableCell className="hidden text-center sm:table-cell">{formatScore(u.ccScore)}</TableCell>
                      <TableCell className="hidden text-center sm:table-cell">{u.isAbsent ? 'ABS' : formatScore(u.examScore)}{u.session === 'RATTRAPAGE' && <sup className="text-primary"> R</sup>}</TableCell>
                      <TableCell className="text-center font-semibold">{formatScore(u.final)}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[u.status]}>{UE_STATUS_LABELS[u.status]}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

function Documents({ currentYear, canRequest }: { currentYear: string | null; canRequest: boolean }) {
  const { data: certs = [] } = useMyCertificates();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const request = async () => {
    setBusy(true);
    if (await openDocument(`/me/certificate?year=${currentYear}`, 'certificat.pdf')) {
      toast.success('Certificat de scolarité généré');
      void qc.invalidateQueries({ queryKey: ['me', 'certificates'] });
    }
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Award className="h-5 w-5 text-primary" /> Certificat de scolarité</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">Téléchargez un certificat officiel pour {currentYear ?? 'l’année en cours'}, avec QR code de vérification.</p>
          <Button onClick={request} disabled={!canRequest || busy}><Award /> Obtenir mon certificat</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Mes certificats</CardTitle></CardHeader>
        {!certs.length ? <p className="px-6 pb-6 text-sm text-muted-foreground">Aucun certificat émis.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>N°</TableHead><TableHead>Année</TableHead><TableHead>Émis le</TableHead><TableHead>Statut</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {certs.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.number}</TableCell>
                  <TableCell>{c.academicYear}</TableCell>
                  <TableCell>{formatDateTime(c.issuedAt)}</TableCell>
                  <TableCell><Badge variant={c.status === 'VALIDE' ? 'success' : 'destructive'}>{c.status === 'VALIDE' ? 'Valide' : 'Annulé'}</Badge></TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openDocument(`/me/certificates/${c.id}/pdf`, `${c.number}.pdf`)}><FileDown /> PDF</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

export function MyTimetable() {
  const [semester, setSemester] = useState(1);
  const { data: v, isLoading } = useMyTimetable(semester);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect aria-label="Semestre" className="w-40" value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
          <option value={1}>Semestre 1</option><option value={2}>Semestre 2</option>
        </NativeSelect>
        {v && <Button variant="outline" onClick={() => openDocument(`/me/timetable?semester=${semester}&format=pdf`, 'emploi-du-temps.pdf')}><FileDown /> PDF</Button>}
      </div>
      {isLoading ? <p className="text-muted-foreground">Chargement…</p> : !v
        ? <Card><EmptyState icon={CalendarRange} title="Pas encore d'emploi du temps" text="Il apparaîtra ici dès sa publication par la scolarité." /></Card>
        : <TimetableGrid view={v} />}
    </div>
  );
}

/** Espace étudiant : notes, documents, emploi du temps. */
export function StudentSpace() {
  const { data: space, error, isLoading } = useStudentSpace();
  const [tab, setTab] = useState<Tab>('grades');
  if (isLoading) return <p className="text-muted-foreground">Chargement…</p>;
  if (error || !space) return <Card><EmptyState icon={GraduationCap} title="Espace indisponible" text={error?.message ?? ''} /></Card>;
  const s = space.student;
  const current = space.enrollments[0] ?? null;
  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <StudentAvatar student={s} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{s.lastName.toUpperCase()} {s.firstName} <span className="font-mono text-sm text-muted-foreground">{s.matricule}</span></p>
          <p className="text-sm text-muted-foreground">
            {s.school.name}{current && <> · {current.level.name}{current.specialty && ` · ${current.specialty.name}`} · {current.academicYear.label} ({ENROLLMENT_STATUS_LABELS[current.status]})</>}
          </p>
        </div>
      </Card>
      <Tabs<Tab> value={tab} onChange={setTab} items={[{ value: 'grades', label: 'Mes notes' }, { value: 'documents', label: 'Mes documents' }, { value: 'timetable', label: 'Mon emploi du temps' }]} />
      {tab === 'grades' && (space.enrollments.length
        ? <Grades years={space.enrollments.map((e) => ({ label: e.academicYear.label, deliberated: e.deliberated }))} />
        : <Card><EmptyState icon={ScrollText} title="Aucune inscription" text="Vos notes apparaîtront après votre inscription." /></Card>)}
      {tab === 'documents' && <Documents currentYear={current?.academicYear.label ?? null} canRequest={!!current && ['INSCRIT', 'ADMIS', 'AJOURNE'].includes(current.status)} />}
      {tab === 'timetable' && <MyTimetable />}
    </div>
  );
}
