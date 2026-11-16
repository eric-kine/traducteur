import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GenerateScheduleInput, MoveSessionInput, RoomDto, RoomInput, TimeslotDto, TimetableView, Unavailability } from '@scolarix/shared';
import { api } from '@/lib/api';
import { openDocument } from '@/lib/open-document';

export const useTimeslots = () => useQuery({ queryKey: ['timeslots'], queryFn: () => api<{ data: TimeslotDto[] }>('/timeslots').then((r) => r.data) });
export const useRooms = () => useQuery({ queryKey: ['rooms'], queryFn: () => api<{ data: RoomDto[] }>('/rooms').then((r) => r.data) });

export function useSaveTimeslots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slots: { startTime: string; endTime: string }[]) => api<{ data: TimeslotDto[] }>('/timeslots', { method: 'PUT', body: { slots } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeslots'] }),
  });
}

export function useSaveRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<RoomInput> & { id?: string }) => (id ? api(`/rooms/${id}`, { method: 'PATCH', body }) : api('/rooms', { method: 'POST', body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }),
  });
}
export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api(`/rooms/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }) });
}

export function useSaveTeacherUnavailability(teacherId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (unavailability: Unavailability) => api(`/teachers/${teacherId}/unavailability`, { method: 'PUT', body: { unavailability } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teachers'] }),
  });
}

// ---- Emplois du temps ----
const levelKey = (levelId: string, yearId: string, semester: number) => ['timetable', 'level', levelId, yearId, semester];

export const useLevelTimetable = (levelId: string, academicYearId: string, semester: number) =>
  useQuery({
    queryKey: levelKey(levelId, academicYearId, semester),
    enabled: !!levelId && !!academicYearId,
    queryFn: () => api<{ timetable: TimetableView | null }>(`/schedules?levelId=${levelId}&academicYearId=${academicYearId}&semester=${semester}`).then((r) => r.timetable),
  });

export const useResourceTimetable = (kind: 'teacher' | 'room', id: string, academicYearId: string, semester: number) =>
  useQuery({
    queryKey: ['timetable', kind, id, academicYearId, semester],
    enabled: !!id && !!academicYearId,
    queryFn: () => api<{ timetable: TimetableView }>(`/timetables/${kind}/${id}?academicYearId=${academicYearId}&semester=${semester}`).then((r) => r.timetable),
  });

/** Toute action renvoie la grille à jour : on la range dans le cache et on rafraîchit les vues enseignant/salle. */
function useTimetableMutation<T>(fn: (v: T) => Promise<{ timetable: TimetableView }>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: ({ timetable: t }) => {
      const s = t.schedule!;
      qc.setQueryData(levelKey(s.level.id, s.academicYear.id, s.semester), t);
      void qc.invalidateQueries({ queryKey: ['timetable', 'teacher'] });
      void qc.invalidateQueries({ queryKey: ['timetable', 'room'] });
    },
  });
}

export const useGenerate = () => useTimetableMutation((body: GenerateScheduleInput) => api<{ timetable: TimetableView }>('/schedules/generate', { method: 'POST', body }));
export const useMoveSession = () =>
  useTimetableMutation(({ id, ...body }: MoveSessionInput & { id: string }) => api<{ timetable: TimetableView }>(`/schedule-sessions/${id}`, { method: 'PATCH', body }));
export const useDeleteSession = () => useTimetableMutation((id: string) => api<{ timetable: TimetableView }>(`/schedule-sessions/${id}`, { method: 'DELETE' }));
export const useSetStatus = () =>
  useTimetableMutation(({ id, status }: { id: string; status: 'BROUILLON' | 'PUBLIE' }) => api<{ timetable: TimetableView }>(`/schedules/${id}`, { method: 'PATCH', body: { status } }));

export const openSchedulePdf = (id: string) => openDocument(`/schedules/${id}/pdf`, 'emploi-du-temps.pdf');
export const openResourcePdf = (kind: 'teacher' | 'room', id: string, yearId: string, semester: number) =>
  openDocument(`/timetables/${kind}/${id}?academicYearId=${yearId}&semester=${semester}&format=pdf`, 'emploi-du-temps.pdf');
