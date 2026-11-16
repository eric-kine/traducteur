import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { GradeSheet, LevelResultsRow, SaveGradeSheetInput } from '@scolarix/shared';
import { api } from '@/lib/api';

export type Session = 'NORMALE' | 'RATTRAPAGE';

export const useGradeSheet = (unitId: string, academicYearId: string, session: Session) =>
  useQuery({
    queryKey: ['grades', unitId, academicYearId, session],
    enabled: !!academicYearId,
    queryFn: () => api<{ sheet: GradeSheet }>(`/teaching-units/${unitId}/grades?academicYearId=${academicYearId}&session=${session}`).then((r) => r.sheet),
  });

export function useSaveGradeSheet(unitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveGradeSheetInput) => api<{ sheet: GradeSheet }>(`/teaching-units/${unitId}/grades`, { method: 'PUT', body }).then((r) => r.sheet),
    onSuccess: (sheet) => {
      qc.setQueryData(['grades', unitId, sheet.academicYear.id, sheet.session], sheet);
      void qc.invalidateQueries({ queryKey: ['results'] });
    },
  });
}

export const useLevelResults = (levelId: string, academicYearId: string) =>
  useQuery({
    queryKey: ['results', levelId, academicYearId],
    enabled: !!academicYearId,
    queryFn: () => api<{ data: LevelResultsRow[] }>(`/levels/${levelId}/results?academicYearId=${academicYearId}`).then((r) => r.data),
  });

export function useDeliberation(levelId: string) {
  const qc = useQueryClient();
  const done = () => { void qc.invalidateQueries({ queryKey: ['results'] }); void qc.invalidateQueries({ queryKey: ['grades'] }); void qc.invalidateQueries({ queryKey: ['students'] }); };
  return {
    deliberate: useMutation({
      mutationFn: (academicYearId: string) => api<{ deliberated: number; admitted: number }>(`/levels/${levelId}/deliberation`, { method: 'POST', body: { academicYearId } }),
      onSuccess: done,
    }),
    reopen: useMutation({
      mutationFn: (academicYearId: string) => api(`/levels/${levelId}/deliberation/reopen`, { method: 'POST', body: { academicYearId } }),
      onSuccess: done,
    }),
  };
}

/**
 * Ouvre le relevé (PDF officiel enregistré au registre, ou aperçu HTML)
 * dans un nouvel onglet. L'onglet est ouvert tout de suite pour ne pas être
 * bloqué par le navigateur, puis rempli quand le document est prêt.
 */
export async function openTranscript(studentId: string, year: string, format: 'pdf' | 'html' = 'pdf') {
  const win = window.open('', '_blank');
  win?.document.write('<p style="font-family:sans-serif;padding:2rem">Génération du relevé…</p>');
  try {
    const blob = await api<Blob>(`/students/${studentId}/transcript?year=${encodeURIComponent(year)}&format=${format}`, { raw: true });
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url;
    else Object.assign(document.createElement('a'), { href: url, download: `releve-${year}.pdf` }).click();
  } catch (e) {
    win?.close();
    toast.error(e instanceof Error ? e.message : 'Impossible de générer le relevé');
  }
}
