import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AssignmentDto, CoverageDto, CreateAssignmentInput, CreateTeacherInput, TeacherDto, TeacherServiceSummary,
  UpdateAssignmentInput, UpdateTeacherInput,
} from '@scolarix/shared';
import { api } from '@/lib/api';

export const useTeachers = (f: { search?: string; status?: string; isActive?: string } = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  return useQuery({ queryKey: ['teachers', f], queryFn: () => api<{ data: TeacherDto[] }>(`/teachers?${p}`).then((r) => r.data) });
};

export const useTeacher = (id: string) =>
  useQuery({ queryKey: ['teachers', 'one', id], queryFn: () => api<{ teacher: TeacherDto }>(`/teachers/${id}`).then((r) => r.teacher) });

export const useTeacherService = (id: string, academicYearId: string) =>
  useQuery({
    queryKey: ['assignments', 'service', id, academicYearId],
    enabled: !!academicYearId,
    queryFn: () => api<{ service: TeacherServiceSummary }>(`/teachers/${id}/service?academicYearId=${academicYearId}`).then((r) => r.service),
  });

export const useAssignments = (f: { teacherId?: string; academicYearId?: string; teachingUnitId?: string }) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  return useQuery({
    queryKey: ['assignments', f],
    enabled: !!f.academicYearId,
    queryFn: () => api<{ data: AssignmentDto[] }>(`/assignments?${p}`).then((r) => r.data),
  });
};

export const useCoverage = (teachingUnitId: string, academicYearId: string) =>
  useQuery({
    queryKey: ['assignments', 'coverage', teachingUnitId, academicYearId],
    enabled: !!teachingUnitId && !!academicYearId,
    queryFn: () => api<{ coverage: CoverageDto }>(`/teaching-units/${teachingUnitId}/coverage?academicYearId=${academicYearId}`).then((r) => r.coverage),
  });

export function useSaveTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: (CreateTeacherInput | UpdateTeacherInput) & { id?: string }) =>
      id ? api<{ teacher: TeacherDto }>(`/teachers/${id}`, { method: 'PATCH', body }) : api<{ teacher: TeacherDto }>('/teachers', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teachers'] }),
  });
}

export function useDeleteTeacher() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api(`/teachers/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['teachers'] }) });
}

export function useSaveAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: (CreateAssignmentInput | UpdateAssignmentInput) & { id?: string }) =>
      id ? api(`/assignments/${id}`, { method: 'PATCH', body }) : api('/assignments', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api(`/assignments/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }) });
}
