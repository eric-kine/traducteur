import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Download, FileUp, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { STUDENT_CSV_COLUMNS, STUDENT_CSV_REQUIRED, type ImportReport } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FormField } from '@/components/common/FormField';
import { useAuth } from '@/stores/auth.store';
import { useSchools } from '../schools/schools.api';
import { useAcademicYears, useCurrentYear } from '../academic-years/academic-years.api';
import { useImportStudents } from './students.api';

/** Modèle téléchargeable : séparateur ";" pour s'ouvrir directement dans Excel (version française). */
function downloadTemplate() {
  const lines = [
    STUDENT_CSV_COLUMNS.join(';'),
    'Diallo;Awa;F;15/03/2005;Dakar;Sénégalaise;awa.diallo@mail.sn;+221 77 000 00 01;Dakar Plateau;Moussa Diallo;Père;+221 77 000 00 02;;L1;GL',
    'Sarr;Ousmane;M;30/07/2004;Thiès;Sénégalaise;;;;;;;;L1;',
  ];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'modele-import-etudiants.csv' });
  a.click();
  URL.revokeObjectURL(a.href);
}

const STATUS = {
  ok: { label: 'Valide', variant: 'success' as const, icon: CheckCircle2 },
  error: { label: 'Erreur', variant: 'destructive' as const, icon: XCircle },
  duplicate: { label: 'Doublon', variant: 'muted' as const, icon: Copy },
};

/**
 * Import en 2 temps :
 *  1. « Vérifier » : le serveur contrôle chaque ligne sans rien enregistrer
 *  2. « Importer » : seules les lignes valides sont enregistrées
 */
export function ImportStudentsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuth((s) => s.user);
  const { data: schools = [] } = useSchools({ isActive: 'true' });
  const { data: years = [] } = useAcademicYears();
  const currentYear = useCurrentYear();
  const run = useImportStudents();
  const [schoolId, setSchoolId] = useState('');
  const [yearId, setYearId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSchoolId(user?.schoolId ?? (schools.length === 1 ? schools[0]!.id : ''));
    setYearId(currentYear?.id ?? '');
    setFile(null);
    setReport(null);
    setError(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (dryRun: boolean) => {
    if (!file || !schoolId) return;
    setError(null);
    try {
      const r = await run.mutateAsync({ file, schoolId, academicYearId: yearId || undefined, dryRun });
      setReport(r);
      if (!dryRun) {
        toast.success(`${r.imported} étudiant(s) importé(s)`);
      }
    } catch (e) {
      setReport(null);
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const imported = report && !report.dryRun;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importer des étudiants (CSV)</DialogTitle>
          <DialogDescription>
            Colonnes obligatoires : {STUDENT_CSV_REQUIRED.join(', ')}. Dates au format JJ/MM/AAAA. Les colonnes « niveau » et « specialite »
            (codes, ex. L1 et GL) inscrivent l'étudiant pour l'année choisie.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}><Download /> Télécharger le modèle</Button>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="imp-school" label="École *">
              <NativeSelect id="imp-school" value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setReport(null); }} disabled={!!imported}>
                <option value="">—</option>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </NativeSelect>
            </FormField>
            <FormField id="imp-year" label="Année d'inscription">
              <NativeSelect id="imp-year" value={yearId} onChange={(e) => { setYearId(e.target.value); setReport(null); }} disabled={!!imported}>
                <option value="">Aucune (pas d'inscription)</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
              </NativeSelect>
            </FormField>
            <FormField id="imp-file" label="Fichier CSV *">
              <Input id="imp-file" type="file" accept=".csv,text/csv" disabled={!!imported}
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); }} />
            </FormField>
          </div>

          {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          {report && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">{report.total} ligne(s)</Badge>
                <Badge variant="success">{report.valid} valide(s)</Badge>
                {report.errors > 0 && <Badge variant="destructive">{report.errors} en erreur</Badge>}
                {report.duplicates > 0 && <Badge variant="muted">{report.duplicates} doublon(s)</Badge>}
                {imported && <Badge>{report.imported} importé(s)</Badge>}
              </div>
              <div className="max-h-72 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Ligne</TableHead>
                      <TableHead>Étudiant</TableHead>
                      <TableHead className="w-28">Résultat</TableHead>
                      <TableHead>Détail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.map((r) => {
                      const st = STATUS[r.status];
                      return (
                        <TableRow key={r.line}>
                          <TableCell className="text-muted-foreground">{r.line}</TableCell>
                          <TableCell className="font-medium">{r.name || '—'}</TableCell>
                          <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                          <TableCell className="text-xs">
                            {r.matricule ? <span className="font-mono">{r.matricule}</span> : r.errors.join(' · ') || (report.dryRun ? 'Prêt à importer' : '')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{imported ? 'Fermer' : 'Annuler'}</Button>
          {!imported && (
            <>
              <Button type="button" variant="secondary" disabled={!file || !schoolId || run.isPending} onClick={() => send(true)}>
                <FileUp /> Vérifier le fichier
              </Button>
              <Button type="button" disabled={!report?.valid || run.isPending} onClick={() => send(false)}>
                Importer {report?.valid ? `${report.valid} étudiant(s)` : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
