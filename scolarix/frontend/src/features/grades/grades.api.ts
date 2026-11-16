import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GradeSheet, LevelResultsRow, SaveGradeSheetInput } from '@scolarix/shared';
import { api } from '@/lib/api';
import { openDocument } from '@/lib/open-document';

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

/** Ouvre le relevé (PDF officiel enregistré au registre, ou aperçu HTML) dans un nouvel onglet. */
export const openTranscript = (studentId: string, year: string, format: 'pdf' | 'html' = 'pdf') =>
  openDocument(`/students/${studentId}/transcript?year=${encodeURIComponent(year)}&format=${format}`, `releve-${year}.pdf`);
