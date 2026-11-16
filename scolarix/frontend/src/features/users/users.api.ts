import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserInput, Paginated, Role, UpdateUserInput, UserDto } from '@scolarix/shared';
import { api } from '@/lib/api';

export interface UsersFilters {
  search?: string;
  role?: Role | '';
  isActive?: 'true' | 'false' | '';
  page: number;
}

const toQuery = (f: UsersFilters) => {
  const p = new URLSearchParams({ page: String(f.page), pageSize: '20' });
  if (f.search) p.set('search', f.search);
  if (f.role) p.set('role', f.role);
  if (f.isActive) p.set('isActive', f.isActive);
  return p.toString();
};

export const useUsers = (filters: UsersFilters) =>
  useQuery({
    queryKey: ['users', filters],
    queryFn: () => api<Paginated<UserDto>>(`/users?${toQuery(filters)}`),
    placeholderData: keepPreviousData,
  });

function useInvalidateUsers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['users'] });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (body: CreateUserInput) => api<{ user: UserDto }>('/users', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateUserInput & { id: string }) =>
      api<{ user: UserDto }>(`/users/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api(`/users/${id}/reset-password`, { method: 'POST', body: { password } }),
  });
}
