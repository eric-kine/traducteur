import { useEffect, useState } from 'react';
import { Lock, Trash2, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { WEEKDAY_LABELS, type SessionView, type TimetableView } from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/select';
import { FormField } from '@/components/common/FormField';
import { useTeachers } from '../teachers/teachers.api';
import { useDeleteSession, useMoveSession, useRooms } from './schedules.api';

/** Détail d'une séance : changer de salle, d'enseignant, de case ; épingler ; supprimer. */
export function SessionDialog({ session, view, onClose }: { session: SessionView | null; view: TimetableView; onClose: () => void }) {
  const { data: rooms = [] } = useRooms();
  const { data: teachers = [] } = useTeachers({ isActive: 'true' });
  const move = useMoveSession();
  const del = useDeleteSession();
  const [cell, setCell] = useState('');
  const [roomId, setRoomId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  useEffect(() => {
    if (!session) return;
    setCell(`${session.day}|${session.timeslotId}`);
    setRoomId(session.room?.id ?? '');
    setTeacherId(session.teacher?.id ?? '');
  }, [session]);
  if (!session) return null;

  const run = (p: Promise<unknown>, ok: string) => p.then(() => { toast.success(ok); onClose(); }).catch((e: Error) => toast.error(e.message));
  const save = () => {
    const [day, timeslotId] = cell.split('|') as [SessionView['day'], string];
    run(move.mutateAsync({ id: session.id, day, timeslotId, roomId: roomId || null, teacherId: teacherId || null }), 'Séance modifiée');
  };
  const suitable = rooms.filter((r) => r.isActive && r.supportedTypes.includes(session.sessionType));

  return (
    <Dialog open={!!session} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{session.teachingUnit.code} — {session.sessionType}{session.audience ? ` · ${session.audience.code}` : ' · tronc commun'}</DialogTitle>
          <DialogDescription>{session.teachingUnit.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormField id="ss-cell" label="Jour et créneau">
            <NativeSelect id="ss-cell" value={cell} onChange={(e) => setCell(e.target.value)}>
              {view.days.flatMap((d) => view.slots.map((s) => <option key={`${d}|${s.id}`} value={`${d}|${s.id}`}>{WEEKDAY_LABELS[d]} {s.startTime}–{s.endTime}</option>))}
            </NativeSelect>
          </FormField>
          <FormField id="ss-room" label={`Salle (accueillant les ${session.sessionType})`}>
            <NativeSelect id="ss-room" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Sans salle</option>
              {suitable.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.capacity} places</option>)}
            </NativeSelect>
          </FormField>
          <FormField id="ss-teacher" label="Enseignant">
            <NativeSelect id="ss-teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">À désigner</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.lastName.toUpperCase()} {t.firstName}</option>)}
            </NativeSelect>
          </FormField>
          <p className="text-xs text-muted-foreground">Une séance modifiée à la main est épinglée : elle reste en place si l'emploi du temps est régénéré.</p>
        </div>
        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => run(move.mutateAsync({ id: session.id, locked: !session.locked }), session.locked ? 'Séance libérée' : 'Séance épinglée')}>
              {session.locked ? <><Unlock /> Libérer</> : <><Lock /> Épingler</>}
            </Button>
            <Button variant="outline" onClick={() => run(del.mutateAsync(session.id), 'Séance supprimée')}><Trash2 className="text-destructive" /> Supprimer</Button>
          </div>
          <Button onClick={save} disabled={move.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
