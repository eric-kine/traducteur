import { useQuery } from '@tanstack/react-query';
import type { CertificateDto, MyCourseStudents, MyStudentSpace, MyTeacherSpace, TimetableView, TranscriptData } from '@scolarix/shared';
import { api } from '@/lib/api';

export const useStudentSpace = () => useQuery({ queryKey: ['me', 'student'], queryFn: () => api<{ space: MyStudentSpace }>('/me/student').then((r) => r.space), retry: false });
export const useMyResults = (year: string) =>
  useQuery({
    queryKey: ['me', 'results', year], enabled: !!year,
    queryFn: () => api<{ results: Pick<TranscriptData, 'semesters' | 'year'> & { academicYear: string; deliberatedAt: string | null } }>(`/me/results?year=${year}`).then((r) => r.results),
  });
export const useMyCertificates = () => useQuery({ queryKey: ['me', 'certificates'], queryFn: () => api<{ data: CertificateDto[] }>('/me/certificates').then((r) => r.data) });
export const useMyTimetable = (semester: number) =>
  useQuery({ queryKey: ['me', 'timetable', semester], queryFn: () => api<{ timetable: TimetableView | null }>(`/me/timetable?semester=${semester}`).then((r) => r.timetable) });

export const useTeacherSpace = () => useQuery({ queryKey: ['me', 'teacher'], queryFn: () => api<{ space: MyTeacherSpace }>('/me/teacher').then((r) => r.space), retry: false });
export const useCourseStudents = (ueId: string | null, yearId: string) =>
  useQuery({
    queryKey: ['me', 'course', ueId, yearId], enabled: !!ueId && !!yearId,
    queryFn: () => api<{ course: MyCourseStudents }>(`/me/teacher/courses/${ueId}/students?academicYearId=${yearId}`).then((r) => r.course),
  });
