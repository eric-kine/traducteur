import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { SchoolDto } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { isAdmin } from '@/lib/permissions';
import { useAuth } from '@/stores/auth.store';
import { useDeleteSchool, useSchools } from './schools.api';
import { SchoolFormDialog } from './SchoolFormDialog';

export function SchoolsPanel() {
  const admin = isAdmin(useAuth((s) => s.user));
  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState<'' | 'true' | 'false'>('');
  const { data: schools, isLoading } = useSchools({ isActive });
  const del = useDeleteSchool();
  const [form, setForm] = useState<{ open: boolean; school?: SchoolDto | null }>({ open: false });
  const [toDelete, setToDelete] = useState<SchoolDto | null>(null);

  // Filtrage texte côté navigateur : la liste des écoles est courte
  const q = search.trim().toLowerCase();
  const visible = schools?.filter((s) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher une école…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher une école" />
        </div>
        <NativeSelect className="w-auto" aria-label="Filtrer par statut" value={isActive} onChange={(e) => setIsActive(e.target.value as typeof isActive)}>
          <option value="">Toutes</option>
          <option value="true">Actives</option>
          <option value="false">Inactives</option>
        </NativeSelect>
        {admin && (
          <Button onClick={() => setForm({ open: true, school: null })}>
            <Plus /> Nouvelle école
          </Button>
        )}
      </div>

      <Card>
        {isLoading ? (
          <p className="p-6 text-muted-foreground">Chargement…</p>
        ) : !visible?.length ? (
          <EmptyState
            icon={Building2}
            title="Aucune école"
            text={schools?.length ? 'Aucun résultat pour cette recherche.' : "Créez la première école de l'institut."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>École</TableHead>
                <TableHead className="hidden text-center sm:table-cell">Spécialités</TableHead>
                <TableHead className="hidden text-center sm:table-cell">Niveaux</TableHead>
                <TableHead className="hidden text-center md:table-cell">Étudiants</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((s) => (
                <TableRow key={s.id}>
                  <TableCell><Badge variant="secondary" className="font-mono">{s.code}</Badge></TableCell>
                  <TableCell>
                    <Link to={`/admin/schools/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
                    {s.directorName && <p className="text-xs text-muted-foreground">Dir. {s.directorName}</p>}
                  </TableCell>
                  <TableCell className="hidden text-center sm:table-cell">{s._count.specialties}</TableCell>
                  <TableCell className="hidden text-center sm:table-cell">{s._count.levels}</TableCell>
                  <TableCell className="hidden text-center md:table-cell">{s._count.students}</TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? 'success' : 'muted'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {admin && (
                        <>
                          <Button variant="ghost" size="icon" title="Modifier" onClick={() => setForm({ open: true, school: s })}><Pencil /></Button>
                          <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setToDelete(s)}><Trash2 className="text-destructive" /></Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" title="Spécialités et niveaux" asChild>
                        <Link to={`/admin/schools/${s.id}`}><ChevronRight /></Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <SchoolFormDialog open={form.open} school={form.school} onClose={() => setForm({ open: false })} />
      <ConfirmDialog
        open={!!toDelete}
        title={`Supprimer « ${toDelete?.name} » ?`}
        description="Possible uniquement si l'école n'a ni spécialité, ni niveau, ni étudiant. Sinon, désactivez-la."
        onConfirm={() => del.mutateAsync(toDelete!.id)}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
