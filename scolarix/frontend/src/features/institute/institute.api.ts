import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InstituteDto, InstituteInput } from '@scolarix/shared';
import { api, ApiError } from '@/lib/api';

export const useInstitute = () =>
  useQuery({
    queryKey: ['institute'],
    // 404 = pas encore configuré → null (le formulaire s'affiche vide)
    queryFn: () =>
      api<{ institute: InstituteDto }>('/institute')
        .then((r) => r.institute)
        .catch((e) => {
          if (e instanceof ApiError && e.status === 404) return null;
          throw e;
        }),
  });

export function useSaveInstitute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: InstituteInput) => api<{ institute: InstituteDto }>('/institute', { method: 'PUT', body }),
    onSuccess: (r) => qc.setQueryData(['institute'], r.institute),
  });
}
