import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { AccountResult, UserDto } from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/common/FormField';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

/**
 * Compte de connexion d'une fiche (enseignant ou étudiant) : affiche le compte
 * relié, ou permet de le créer. Le mot de passe provisoire n'est montré qu'une fois.
 */
export function AccountCard({ kind, id, email }: { kind: 'teachers' | 'students'; id: string; email: string | null }) {
  const qc = useQueryClient();
  const key = ['account', kind, id];
  const { data: user, isLoading } = useQuery({ queryKey: key, queryFn: () => api<{ user: UserDto | null }>(`/${kind}/${id}/account`).then((r) => r.user) });
  const [askEmail, setAskEmail] = useState(false);
  const [login, setLogin] = useState(email ?? '');
  const [result, setResult] = useState<AccountResult | null>(null);
  const create = useMutation({
    mutationFn: () => api<AccountResult>(`/${kind}/${id}/account`, { method: 'POST', body: kind === 'students' && login ? { email: login } : {} }),
    onSuccess: (r) => { setResult(r); setAskEmail(false); void qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Compte de connexion</CardTitle>
        <CardDescription>{kind === 'teachers' ? "Permet à l'enseignant de saisir ses notes, rédiger ses syllabus et voir son emploi du temps." : "Permet à l'étudiant de consulter ses notes, relevés, certificats et emploi du temps."}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {isLoading ? '…' : user ? (
          <p className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-emerald-600" /> <b>{user.email}</b>
            <span className="text-muted-foreground">· {user.isActive ? 'actif' : 'désactivé'} · dernière connexion : {formatDateTime(user.lastLoginAt)}</span></p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground">Aucun compte pour l'instant.</p>
            <Button size="sm" onClick={() => (kind === 'students' && !email ? setAskEmail(true) : create.mutate())} disabled={create.isPending}>Créer le compte</Button>
          </div>
        )}
      </CardContent>

      <Dialog open={askEmail} onOpenChange={setAskEmail}>
        <DialogContent>
          <DialogHeader><DialogTitle>Email de connexion</DialogTitle><DialogDescription>La fiche n'a pas d'email : indiquez celui qui servira à se connecter.</DialogDescription></DialogHeader>
          <FormField id="acc-email" label="Email"><Input id="acc-email" type="email" value={login} onChange={(e) => setLogin(e.target.value)} /></FormField>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!login || create.isPending}>Créer le compte</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compte {result?.linkedExisting ? 'relié' : 'créé'}</DialogTitle>
            <DialogDescription>
              {result?.temporaryPassword
                ? "Communiquez ces identifiants à la personne. Le mot de passe ne sera plus affiché : elle pourra le changer dans « Mon compte »."
                : 'Un compte existant avec cet email a été relié à la fiche : la personne garde son mot de passe.'}
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="space-y-2 rounded-md border bg-muted/40 p-4 font-mono text-sm">
              <p>Email : <b>{result.user.email}</b></p>
              {result.temporaryPassword && (
                <p className="flex items-center gap-2">Mot de passe : <b>{result.temporaryPassword}</b>
                  <Button size="icon" variant="ghost" title="Copier" onClick={() => navigator.clipboard?.writeText(result.temporaryPassword!).then(() => toast.success('Copié'))}><Copy /></Button>
                </p>
              )}
            </div>
          )}
          <DialogFooter><Button onClick={() => setResult(null)}>J'ai noté les identifiants</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
