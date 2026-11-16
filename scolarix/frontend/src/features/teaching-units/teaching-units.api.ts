import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTeachingUnitInput, TeachingUnitListResponse, UpdateTeachingUnitInput } from '@scolarix/shared';
import { api } from '@/lib/api';

export interface TeachingUnitFilters {
  semester?: '' | '1' | '2';
  specialtyId?: string; // '' | 'common' | uuid
  search?: string;
}

export const useTeachingUnits = (levelId: string, f: TeachingUnitFilters = {}) => {
  const p = new URLSearchParams();
  if (f.semester) p.set('semester', f.semester);
  if (f.specialtyId) p.set('specialtyId', f.specialtyId);
  if (f.search) p.set('search', f.search);
  return useQuery({
    queryKey: ['teaching-units', levelId, f],
    enabled: !!levelId,
    queryFn: () => api<TeachingUnitListResponse>(`/levels/${levelId}/teaching-units?${p}`),
    placeholderData: keepPreviousData,
  });
};

function useInvalidate(levelId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['teaching-units', levelId] });
}

export function useSaveTeachingUnit(levelId: string) {
  const invalidate = useInvalidate(levelId);
  return useMutation({
    mutationFn: ({ id, ...body }: (CreateTeachingUnitInput | UpdateTeachingUnitInput) & { id?: string }) =>
      id
        ? api(`/teaching-units/${id}`, { method: 'PATCH', body })
        : api(`/levels/${levelId}/teaching-units`, { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteTeachingUnit(levelId: string) {
  const invalidate = useInvalidate(levelId);
  return useMutation({ mutationFn: (id: string) => api(`/teaching-units/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
}
