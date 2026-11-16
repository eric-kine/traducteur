import { useParams } from 'react-router-dom';
import { CheckCircle2, GraduationCap, SearchX, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useVerification } from './certificates.api';

const TYPE_LABEL = { CERTIFICAT_SCOLARITE: 'Certificat de scolarité', RELEVE_NOTES: 'Relevé de notes' } as const;

/** Page publique (sans connexion) ouverte en scannant le QR code d'un document. */
export function VerifyPage() {
  const { code = '' } = useParams();
  const { data: r, isLoading, error } = useVerification(code);

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-br from-primary/10 via-background to-background p-4 pt-12">
      <div className="mb-6 flex items-center gap-2 text-primary"><GraduationCap className="h-7 w-7" /><span className="text-xl font-bold">Scolarix</span></div>
      <Card className="w-full max-w-lg">
        <CardContent className="p-6">
          <h1 className="mb-1 text-lg font-semibold">Vérification d'un document</h1>
          <p className="mb-5 font-mono text-sm text-muted-foreground">Code {code.toUpperCase()}</p>
          {isLoading ? <p className="text-muted-foreground">Vérification…</p> : !r ? (
            <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
              <SearchX className="mt-0.5 h-5 w-5 shrink-0" />
              <div><p className="font-semibold">Document introuvable</p><p className="text-sm">{error?.message ?? 'Ce code ne correspond à aucun document émis.'} Il peut s'agir d'un faux.</p></div>
            </div>
          ) : (
            <>
              <div className={cn('mb-5 flex items-start gap-3 rounded-md border p-4', r.valid ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-destructive/30 bg-destructive/10 text-destructive')}>
                {r.valid ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="font-semibold">{r.valid ? 'Document authentique et valide' : 'Document ANNULÉ'}</p>
                  <p className="text-sm">
                    {r.valid ? 'Vérifiez que les informations ci-dessous correspondent au document papier.' : `Ce document a été annulé le ${new Date(r.revokedAt!).toLocaleDateString('fr-FR')} et n'a plus de valeur.`}
                  </p>
                </div>
              </div>
              <Row label="Type" value={TYPE_LABEL[r.type]} />
              <Row label="Référence" value={r.reference} />
              <Row label="Émis le" value={new Date(r.issuedAt).toLocaleDateString('fr-FR', { dateStyle: 'long' })} />
              <Row label="Étudiant" value={r.student.fullName} />
              <Row label="Matricule" value={r.student.matricule} />
              <Row label="Niveau" value={r.level} />
              <Row label="Année académique" value={r.academicYear} />
              <Row label="Établissement" value={`${r.school} — ${r.institute}`} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
