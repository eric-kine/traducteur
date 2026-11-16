import { useEffect, useState } from 'react';
import { DoorOpen, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { SESSION_TYPES, type RoomDto, type SessionType, type Unavailability } from '@scolarix/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { FormField } from '@/components/common/FormField';
import { ApiError } from '@/lib/api';
import { isAdmin } from '@/lib/permissions';
import { useAuth } from '@/stores/auth.store';
import { useDeleteRoom, useRooms, useSaveRoom, useSaveTimeslots, useTimeslots } from './schedules.api';
import { AvailabilityGrid } from './AvailabilityGrid';

function RoomDialog({ room, open, onClose }: { room: RoomDto | null; open: boolean; onClose: () => void }) {
  const save = useSaveRoom();
  const { data: slots = [] } = useTimeslots();
  const [v, setV] = useState({ code: '', name: '', building: '', capacity: '30', types: ['CM', 'TD'] as SessionType[], unav: [] as Unavailability });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setV(room
      ? { code: room.code, name: room.name ?? '', building: room.building ?? '', capacity: String(room.capacity), types: room.supportedTypes, unav: room.unavailability }
      : { code: '', name: '', building: '', capacity: '30', types: ['CM', 'TD'], unav: [] });
  }, [open, room]);
  const submit = async () => {
    try {
      await save.mutateAsync({ id: room?.id, code: v.code, name: v.name, building: v.building, capacity: Number(v.capacity), supportedTypes: v.types, unavailability: v.unav });
      toast.success(room ? 'Salle modifiée' : 'Salle créée');
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(Object.fromEntries(Object.entries(e.details).map(([k, m]) => [k, m[0]!])));
      else toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{room ? `Salle ${room.code}` : 'Nouvelle salle'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[120px_1fr_120px]">
            <FormField id="r-code" label="Code *" error={errors.code}><Input id="r-code" className="uppercase" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} /></FormField>
            <FormField id="r-name" label="Nom" error={errors.name}><Input id="r-name" placeholder="Amphithéâtre A" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></FormField>
            <FormField id="r-cap" label="Places *" error={errors.capacity}><Input id="r-cap" type="number" min={1} value={v.capacity} onChange={(e) => setV({ ...v, capacity: e.target.value })} /></FormField>
          </div>
          <FormField id="r-building" label="Bâtiment"><Input id="r-building" value={v.building} onChange={(e) => setV({ ...v, building: e.target.value })} /></FormField>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Séances accueillies *</legend>
            <div className="flex gap-4">
              {SESSION_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={v.types.includes(t)} onChange={(e) => setV({ ...v, types: e.target.checked ? [...v.types, t] : v.types.filter((x) => x !== t) })} /> {t}
                </label>
              ))}
            </div>
            {errors.supportedTypes && <p className="mt-1 text-sm text-destructive">{errors.supportedTypes}</p>}
          </fieldset>
          <div>
            <p className="mb-2 text-sm font-medium">Disponibilités (cliquez pour rendre un créneau indisponible)</p>
            <AvailabilityGrid slots={slots} value={v.unav} onChange={(unav) => setV({ ...v, unav })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={save.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimeslotsCard({ readOnly }: { readOnly: boolean }) {
  const { data = [] } = useTimeslots();
  const save = useSaveTimeslots();
  const [rows, setRows] = useState<{ startTime: string; endTime: string }[]>([]);
  useEffect(() => setRows(data.map(({ startTime, endTime }) => ({ startTime, endTime }))), [data]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Créneaux horaires</CardTitle>
        <CardDescription>Identiques du lundi au samedi. Par défaut : 08h-12h et 14h-18h en créneaux de 2 h.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input type="time" className="w-32" aria-label={`Début du créneau ${i + 1}`} value={r.startTime} disabled={readOnly} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, startTime: e.target.value } : x)))} />
            <span>→</span>
            <Input type="time" className="w-32" aria-label={`Fin du créneau ${i + 1}`} value={r.endTime} disabled={readOnly} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, endTime: e.target.value } : x)))} />
            {!readOnly && <Button variant="ghost" size="icon" title="Retirer" onClick={() => setRows(rows.filter((_, j) => j !== i))}><X /></Button>}
          </div>
        ))}
        {!readOnly && (
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setRows([...rows, { startTime: '18:00', endTime: '20:00' }])}><Plus /> Ajouter</Button>
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(rows, { onSuccess: () => toast.success('Créneaux enregistrés'), onError: (e) => toast.error(e.message) })}>Enregistrer</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Onglet Administration → Salles & créneaux. */
export function RoomsPanel() {
  const admin = isAdmin(useAuth((s) => s.user));
  const { data: rooms = [], isLoading } = useRooms();
  const del = useDeleteRoom();
  const [form, setForm] = useState<{ open: boolean; room: RoomDto | null }>({ open: false, room: null });
  const [toDelete, setToDelete] = useState<RoomDto | null>(null);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <div className="flex items-center justify-between border-b p-4">
          <p className="text-sm text-muted-foreground">Salles partagées par toutes les écoles</p>
          {admin && <Button onClick={() => setForm({ open: true, room: null })}><Plus /> Nouvelle salle</Button>}
        </div>
        {isLoading ? <p className="p-6 text-muted-foreground">Chargement…</p> : !rooms.length ? (
          <EmptyState icon={DoorOpen} title="Aucune salle" text="Ajoutez les salles (capacité, types de séances) pour que le générateur puisse les attribuer." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Salle</TableHead><TableHead className="text-center">Places</TableHead><TableHead>Séances</TableHead><TableHead className="hidden sm:table-cell">Indisponibilités</TableHead>{admin && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {rooms.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><b className="font-mono">{r.code}</b> <span className="text-muted-foreground">{r.name}</span>{r.building && <p className="text-xs text-muted-foreground">{r.building}</p>}</TableCell>
                  <TableCell className="text-center">{r.capacity}</TableCell>
                  <TableCell><div className="flex gap-1">{r.supportedTypes.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div></TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{r.unavailability.length ? `${r.unavailability.length} créneau(x)` : 'Toujours disponible'}</TableCell>
                  {admin && (
                    <TableCell><div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Modifier" onClick={() => setForm({ open: true, room: r })}><Pencil /></Button>
                      <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setToDelete(r)}><Trash2 className="text-destructive" /></Button>
                    </div></TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <TimeslotsCard readOnly={!admin} />
      <RoomDialog open={form.open} room={form.room} onClose={() => setForm({ open: false, room: null })} />
      <ConfirmDialog open={!!toDelete} title={`Supprimer la salle ${toDelete?.code} ?`} description="Impossible si elle est utilisée dans un emploi du temps."
        onConfirm={() => del.mutateAsync(toDelete!.id)} onClose={() => setToDelete(null)} />
    </div>
  );
}
