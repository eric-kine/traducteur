import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateEnrollmentInput, CreateStudentInput, EnrollmentDto, ImportReport, Paginated, StudentDto,
  UpdateEnrollmentInput, UpdateStudentInput,
} from '@scolarix/shared';
import { api } from '@/lib/api';

export interface StudentFilters {
  search?: string;
  schoolId?: string;
  academicYearId?: string;
  levelId?: string;
  specialtyId?: string;
  status?: string;
  page: number;
}

export const useStudents = (f: StudentFilters) => {
  const p = new URLSearchParams({ page: String(f.page), pageSize: '25' });
  for (const k of ['search', 'schoolId', 'academicYearId', 'levelId', 'specialtyId', 'status'] as const) if (f[k]) p.set(k, f[k]!);
  return useQuery({
    queryKey: ['students', f],
    queryFn: () => api<Paginated<StudentDto>>(`/students?${p}`),
    placeholderData: keepPreviousData,
  });
};

export const useStudent = (id: string) =>
  useQuery({ queryKey: ['students', 'one', id], queryFn: () => api<{ student: StudentDto }>(`/students/${id}`).then((r) => r.student) });

export const useStudentEnrollments = (id: string) =>
  useQuery({ queryKey: ['students', 'enrollments', id], queryFn: () => api<{ data: EnrollmentDto[] }>(`/students/${id}/enrollments`).then((r) => r.data) });

/** Photo chargée avec le jeton (elle n'est pas publique) puis affichée via une URL locale. */
export const useStudentPhoto = (id: string, hasPhoto: boolean, version = 0) =>
  useQuery({
    queryKey: ['students', 'photo', id, version],
    enabled: hasPhoto,
    queryFn: async () => URL.createObjectURL(await api<Blob>(`/students/${id}/photo`, { raw: true })),
    staleTime: Infinity,
  });

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['students'] });
}

export function useSaveStudent() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: (CreateStudentInput | UpdateStudentInput) & { id?: string }) =>
      id
        ? api<{ student: StudentDto }>(`/students/${id}`, { method: 'PATCH', body })
        : api<{ student: StudentDto }>('/students', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteStudent() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api(`/students/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
}

export function useStudentPhotoMutations(id: string) {
  const invalidate = useInvalidate();
  return {
    upload: useMutation({
      mutationFn: (file: File) => {
        const fd = new FormData();
        fd.append('photo', file);
        return api(`/students/${id}/photo`, { method: 'PUT', body: fd });
      },
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: () => api(`/students/${id}/photo`, { method: 'DELETE' }), onSuccess: invalidate }),
  };
}

export function useSaveEnrollment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: (CreateEnrollmentInput | UpdateEnrollmentInput) & { id?: string }) =>
      id ? api(`/enrollments/${id}`, { method: 'PATCH', body }) : api('/enrollments', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteEnrollment() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api(`/enrollments/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
}

export function useImportStudents() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ file, schoolId, academicYearId, dryRun }: { file: File; schoolId: string; academicYearId?: string; dryRun: boolean }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('schoolId', schoolId);
      if (academicYearId) fd.append('academicYearId', academicYearId);
      fd.append('dryRun', String(dryRun));
      return api<ImportReport>('/students/import', { method: 'POST', body: fd });
    },
    onSuccess: (r) => { if (!r.dryRun) void invalidate(); },
  });
}
