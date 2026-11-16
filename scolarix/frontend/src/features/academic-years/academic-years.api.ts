import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AcademicYearDto, CreateAcademicYearInput, UpdateAcademicYearInput } from '@scolarix/shared';
import { api } from '@/lib/api';

export const useAcademicYears = () =>
  useQuery({
    queryKey: ['academic-years'],
    queryFn: () => api<{ data: AcademicYearDto[] }>('/academic-years').then((r) => r.data),
    staleTime: 60_000,
  });

/** Année courante (ou la plus récente), pour pré-remplir les filtres. */
export const useCurrentYear = () => {
  const { data } = useAcademicYears();
  return data?.find((y) => y.isCurrent) ?? data?.[0] ?? null;
};

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['academic-years'] });
}

export function useSaveAcademicYear() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: (CreateAcademicYearInput | UpdateAcademicYearInput) & { id?: string }) =>
      id ? api(`/academic-years/${id}`, { method: 'PATCH', body }) : api('/academic-years', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteAcademicYear() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api(`/academic-years/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
}
