import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, Power, Search } from 'lucide-react';
import { toast } from 'sonner';
import { ROLE_LABELS, ROLES, type Role, type UserDto } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/stores/auth.store';
import { useUpdateUser, useUsers, type UsersFilters } from './users.api';
import { UserFormDialog } from './UserFormDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';

const ROLE_BADGE: Record<Role, 'default' | 'secondary' | 'success' | 'muted'> = {
  ADMIN: 'default',
  SCOLARITE: 'secondary',
  ENSEIGNANT: 'success',
  ETUDIANT: 'muted',
};

export function UsersPage() {
  const me = useAuth((s) => s.user);
  const [filters, setFilters] = useState<UsersFilters>({ page: 1, search: '', role: '', isActive: '' });
  const [searchInput, setSearchInput] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [resetting, setResetting] = useState<UserDto | null>(null);
  const { data, isLoading, isError } = useUsers(filters);
  const updateUser = useUpdateUser();

  // Recherche déclenchée 300 ms après la dernière frappe
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search: searchInput, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggleActive = async (u: UserDto) => {
    try {
      await updateUser.mutateAsync({ id: u.id, isActive: !u.isActive });
      toast.success(u.isActive ? 'Compte désactivé' : 'Compte réactivé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Utilisateurs</h1>
          <p className="text-muted-foreground">Comptes de connexion et rôles</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus /> Nouvel utilisateur
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher (nom, email)…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Rechercher"
            />
          </div>
          <NativeSelect
            aria-label="Filtrer par rôle"
            value={filters.role}
            onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value as Role | '', page: 1 }))}
          >
            <option value="">Tous les rôles</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </NativeSelect>
          <NativeSelect
            aria-label="Filtrer par statut"
            value={filters.isActive}
            onChange={(e) => setFilters((f) => ({ ...f, isActive: e.target.value as UsersFilters['isActive'], page: 1 }))}
          >
            <option value="">Tous les statuts</option>
            <option value="true">Actifs</option>
            <option value="false">Désactivés</option>
          </NativeSelect>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="hidden md:table-cell">Dernière connexion</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
            )}
            {isError && (
              <TableRow><TableCell colSpan={6} className="text-center text-destructive">Impossible de charger les utilisateurs.</TableCell></TableRow>
            )}
            {data?.data.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Aucun utilisateur trouvé.</TableCell></TableRow>
            )}
            {data?.data.map((u) => (
              <TableRow key={u.id} className={u.isActive ? '' : 'opacity-60'}>
                <TableCell className="font-medium">{u.lastName.toUpperCase()} {u.firstName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Badge variant={ROLE_BADGE[u.role]}>{ROLE_LABELS[u.role]}</Badge></TableCell>
                <TableCell>
                  <Badge variant={u.isActive ? 'success' : 'destructive'}>{u.isActive ? 'Actif' : 'Désactivé'}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{formatDateTime(u.lastLoginAt)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Modifier" onClick={() => { setEditing(u); setFormOpen(true); }}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" title="Réinitialiser le mot de passe" onClick={() => setResetting(u)}>
                      <KeyRound />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={u.isActive ? 'Désactiver' : 'Réactiver'}
                      disabled={u.id === me?.id}
                      onClick={() => toggleActive(u)}
                    >
                      <Power className={u.isActive ? 'text-destructive' : 'text-emerald-600'} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data && data.total > 0 && (
          <div className="flex items-center justify-between border-t p-4 text-sm text-muted-foreground">
            <span>{data.total} utilisateur(s)</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>
                Précédent
              </Button>
              <span>Page {filters.page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={filters.page >= totalPages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>
                Suivant
              </Button>
            </div>
          </div>
        )}
      </Card>

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
    </div>
  );
}
