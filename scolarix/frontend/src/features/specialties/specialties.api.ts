import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSpecialtyInput, SpecialtyDto, UpdateSpecialtyInput } from '@scolarix/shared';
import { api } from '@/lib/api';

export const useSpecialties = (schoolId: string) =>
  useQuery({
    queryKey: ['specialties', schoolId],
    queryFn: () => api<{ data: SpecialtyDto[] }>(`/schools/${schoolId}/specialties`).then((r) => r.data),
  });

function useInvalidate(schoolId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['specialties', schoolId] });
    void qc.invalidateQueries({ queryKey: ['schools'] }); // compteurs
  };
}

export function useSaveSpecialty(schoolId: string) {
  const invalidate = useInvalidate(schoolId);
  return useMutation({
    mutationFn: ({ id, ...body }: (CreateSpecialtyInput | UpdateSpecialtyInput) & { id?: string }) =>
      id
        ? api(`/specialties/${id}`, { method: 'PATCH', body })
        : api(`/schools/${schoolId}/specialties`, { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteSpecialty(schoolId: string) {
  const invalidate = useInvalidate(schoolId);
  return useMutation({ mutationFn: (id: string) => api(`/specialties/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
}
