import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSchoolInput, SchoolDto, UpdateSchoolInput } from '@scolarix/shared';
import { api } from '@/lib/api';

export const useSchools = (filters: { search?: string; isActive?: '' | 'true' | 'false' } = {}) => {
  const p = new URLSearchParams();
  if (filters.search) p.set('search', filters.search);
  if (filters.isActive) p.set('isActive', filters.isActive);
  return useQuery({
    queryKey: ['schools', filters],
    queryFn: () => api<{ data: SchoolDto[] }>(`/schools?${p}`).then((r) => r.data),
  });
};

export const useSchool = (id: string) =>
  useQuery({ queryKey: ['schools', id], enabled: !!id, queryFn: () => api<{ school: SchoolDto }>(`/schools/${id}`).then((r) => r.school) });

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['schools'] });
}

export function useSaveSchool() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: (CreateSchoolInput | UpdateSchoolInput) & { id?: string }) =>
      id
        ? api<{ school: SchoolDto }>(`/schools/${id}`, { method: 'PATCH', body })
        : api<{ school: SchoolDto }>('/schools', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteSchool() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api(`/schools/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
}
