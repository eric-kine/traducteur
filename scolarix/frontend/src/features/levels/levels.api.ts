import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateLevelInput, LevelDto, UpdateLevelInput } from '@scolarix/shared';
import { api } from '@/lib/api';

const key = (schoolId: string) => ['levels', schoolId];

export const useLevels = (schoolId: string) =>
  useQuery({
    queryKey: key(schoolId),
    queryFn: () => api<{ data: LevelDto[] }>(`/schools/${schoolId}/levels`).then((r) => r.data),
  });

function useInvalidate(schoolId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: key(schoolId) });
    void qc.invalidateQueries({ queryKey: ['schools'] });
  };
}

export function useSaveLevel(schoolId: string) {
  const invalidate = useInvalidate(schoolId);
  return useMutation({
    mutationFn: ({ id, ...body }: (CreateLevelInput | UpdateLevelInput) & { id?: string }) =>
      id ? api(`/levels/${id}`, { method: 'PATCH', body }) : api(`/schools/${schoolId}/levels`, { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteLevel(schoolId: string) {
  const invalidate = useInvalidate(schoolId);
  return useMutation({ mutationFn: (id: string) => api(`/levels/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
}

/** Réordonnancement avec mise à jour immédiate de l'écran (annulée en cas d'erreur). */
export function useReorderLevels(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (levels: LevelDto[]) =>
      api<{ data: LevelDto[] }>(`/schools/${schoolId}/levels/order`, { method: 'PUT', body: { ids: levels.map((l) => l.id) } }),
    onMutate: async (levels) => {
      await qc.cancelQueries({ queryKey: key(schoolId) });
      const previous = qc.getQueryData<LevelDto[]>(key(schoolId));
      qc.setQueryData(key(schoolId), levels.map((l, i) => ({ ...l, order: i + 1 })));
      return { previous };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key(schoolId), ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: key(schoolId) }),
  });
}
