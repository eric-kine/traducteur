import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { TeacherDto, Unavailability } from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AvailabilityGrid } from '../schedules/AvailabilityGrid';
import { useSaveTeacherUnavailability, useTimeslots } from '../schedules/schedules.api';

/** Disponibilités hebdomadaires de l'enseignant (utilisées par le générateur d'emploi du temps). */
export function TeacherAvailabilityCard({ teacher }: { teacher: TeacherDto }) {
  const { data: slots = [] } = useTimeslots();
  const save = useSaveTeacherUnavailability(teacher.id);
  const [value, setValue] = useState<Unavailability>(teacher.unavailability);
  useEffect(() => setValue(teacher.unavailability), [teacher.unavailability]);
  const dirty = JSON.stringify(value) !== JSON.stringify(teacher.unavailability);
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Disponibilités</CardTitle>
          <CardDescription>Cliquez sur un créneau pour le rendre indisponible. Le générateur d'emploi du temps en tient compte.</CardDescription>
        </div>
        <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate(value, { onSuccess: () => toast.success('Disponibilités enregistrées'), onError: (e) => toast.error(e.message) })}>Enregistrer</Button>
      </CardHeader>
      <CardContent><AvailabilityGrid slots={slots} value={value} onChange={setValue} /></CardContent>
    </Card>
  );
}
