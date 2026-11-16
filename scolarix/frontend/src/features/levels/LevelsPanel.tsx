import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, BookMarked, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { LEVEL_CYCLE_LABELS, type LevelDto } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { useDeleteLevel, useLevels, useReorderLevels } from './levels.api';
import { LevelFormDialog } from './LevelFormDialog';

export function LevelsPanel({ schoolId, canEdit }: { schoolId: string; canEdit: boolean }) {
  const { data, isLoading } = useLevels(schoolId);
  const del = useDeleteLevel(schoolId);
  const reorder = useReorderLevels(schoolId);
  const [form, setForm] = useState<{ open: boolean; level?: LevelDto | null }>({ open: false });
  const [toDelete, setToDelete] = useState<LevelDto | null>(null);

  const move = (index: number, delta: -1 | 1) => {
    if (!data) return;
    const next = [...data];
    [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
    reorder.mutate(next, { onError: (e) => toast.error(e.message) });
  };

  const addButton = canEdit && <Button onClick={() => setForm({ open: true, level: null })}><Plus /> Nouveau niveau</Button>;

  return (
    <Card>
      <div className="flex items-center justify-between border-b p-4">
        <p className="text-sm text-muted-foreground">Progression des études, du premier au dernier niveau</p>
        {!!data?.length && addButton}
      </div>
      {isLoading ? (
        <p className="p-6 text-muted-foreground">Chargement…</p>
      ) : !data?.length ? (
        <EmptyState icon={Layers} title="Aucun niveau" text="Ex. : Niveau 1, Niveau 2, Licence 3, Master 1…" action={addButton} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Ordre</TableHead>
              <TableHead className="w-24">Code</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead className="hidden sm:table-cell">Cycle</TableHead>
              <TableHead className="hidden text-center md:table-cell">Crédits</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((l, i) => (
              <TableRow key={l.id}>
                <TableCell className="font-semibold text-muted-foreground">{l.order}</TableCell>
                <TableCell><Badge variant="secondary" className="font-mono">{l.code}</Badge></TableCell>
                <TableCell className="font-medium">
                  <Link to={`/admin/levels/${l.id}`} className="hover:underline">{l.name}</Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{LEVEL_CYCLE_LABELS[l.cycle]}</TableCell>
                <TableCell className="hidden text-center md:table-cell">{l.requiredCredits}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Unités d'enseignement" asChild>
                      <Link to={`/admin/levels/${l.id}`}><BookMarked /></Link>
                    </Button>
                    {canEdit && (<>
                      <Button variant="ghost" size="icon" title="Monter" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}><ArrowUp /></Button>
                      <Button variant="ghost" size="icon" title="Descendre" disabled={i === data.length - 1 || reorder.isPending} onClick={() => move(i, 1)}><ArrowDown /></Button>
                      <Button variant="ghost" size="icon" title="Modifier" onClick={() => setForm({ open: true, level: l })}><Pencil /></Button>
                      <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setToDelete(l)}><Trash2 className="text-destructive" /></Button>
                    </>)}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <LevelFormDialog schoolId={schoolId} open={form.open} level={form.level} count={data?.length ?? 0} onClose={() => setForm({ open: false })} />
      <ConfirmDialog
        open={!!toDelete}
        title={`Supprimer le niveau « ${toDelete?.name} » ?`}
        description="Impossible si des UE, inscriptions ou emplois du temps y sont rattachés. Les niveaux suivants remontent d'un rang."
        onConfirm={() => del.mutateAsync(toDelete!.id)}
        onClose={() => setToDelete(null)}
      />
    </Card>
  );
}
