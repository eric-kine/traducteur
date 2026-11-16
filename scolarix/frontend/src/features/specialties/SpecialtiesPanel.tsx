import { useState } from 'react';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import type { SpecialtyDto } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { useDeleteSpecialty, useSpecialties } from './specialties.api';
import { SpecialtyFormDialog } from './SpecialtyFormDialog';

export function SpecialtiesPanel({ schoolId, canEdit }: { schoolId: string; canEdit: boolean }) {
  const { data, isLoading } = useSpecialties(schoolId);
  const del = useDeleteSpecialty(schoolId);
  const [form, setForm] = useState<{ open: boolean; specialty?: SpecialtyDto | null }>({ open: false });
  const [toDelete, setToDelete] = useState<SpecialtyDto | null>(null);
  const addButton = canEdit && (
    <Button onClick={() => setForm({ open: true, specialty: null })}><Plus /> Nouvelle spécialité</Button>
  );

  return (
    <Card>
      <div className="flex items-center justify-between border-b p-4">
        <p className="text-sm text-muted-foreground">Filières proposées par l'école</p>
        {!!data?.length && addButton}
      </div>
      {isLoading ? (
        <p className="p-6 text-muted-foreground">Chargement…</p>
      ) : !data?.length ? (
        <EmptyState icon={BookOpen} title="Aucune spécialité" text="Ex. : Génie Logiciel, Réseaux, Finance…" action={addButton} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Code</TableHead>
              <TableHead>Spécialité</TableHead>
              <TableHead className="hidden md:table-cell">Diplôme</TableHead>
              <TableHead>Statut</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((s) => (
              <TableRow key={s.id}>
                <TableCell><Badge variant="secondary" className="font-mono">{s.code}</Badge></TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{s.diplomaTitle ?? '—'}</TableCell>
                <TableCell><Badge variant={s.isActive ? 'success' : 'muted'}>{s.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Modifier" onClick={() => setForm({ open: true, specialty: s })}><Pencil /></Button>
                      <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setToDelete(s)}><Trash2 className="text-destructive" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <SpecialtyFormDialog schoolId={schoolId} open={form.open} specialty={form.specialty} onClose={() => setForm({ open: false })} />
      <ConfirmDialog
        open={!!toDelete}
        title={`Supprimer la spécialité « ${toDelete?.name} » ?`}
        description="Impossible si des UE, inscriptions ou emplois du temps y sont rattachés : désactivez-la alors."
        onConfirm={() => del.mutateAsync(toDelete!.id)}
        onClose={() => setToDelete(null)}
      />
    </Card>
  );
}
