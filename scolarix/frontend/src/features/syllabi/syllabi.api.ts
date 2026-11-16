import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SaveSyllabusInput, SyllabusDto } from '@scolarix/shared';
import { api } from '@/lib/api';
import { downloadFile } from '@/lib/download';
import { openDocument } from '@/lib/open-document';

export const useSyllabus = (unitId: string, year: string) =>
  useQuery({
    queryKey: ['syllabus', unitId, year],
    enabled: !!year,
    queryFn: () => api<{ syllabus: SyllabusDto }>(`/ues/${unitId}/syllabus/data?year=${year}`).then((r) => r.syllabus),
  });

export function useSaveSyllabus(unitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveSyllabusInput) => api<{ syllabus: SyllabusDto }>(`/ues/${unitId}/syllabus`, { method: 'PUT', body }).then((r) => r.syllabus),
    onSuccess: (s) => qc.setQueryData(['syllabus', unitId, s.academicYear.label], s),
  });
}

export const openSyllabus = (unitId: string, year: string, format: 'pdf' | 'html' = 'pdf') =>
  openDocument(`/ues/${unitId}/syllabus?year=${year}&format=${format}`, `syllabus-${year}.pdf`);

export const downloadLevelSyllabi = (levelId: string, year: string, fileLabel: string, semester?: number) =>
  downloadFile(`/levels/${levelId}/syllabi?year=${year}${semester ? `&semester=${semester}` : ''}`, `syllabus-${fileLabel}-${year}.zip`);
