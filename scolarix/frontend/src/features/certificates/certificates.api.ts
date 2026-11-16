import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CertificateDto, Paginated, VerificationResult } from '@scolarix/shared';
import { api, ApiError } from '@/lib/api';
import { openDocument } from '@/lib/open-document';

export interface CertificateFilters { search?: string; academicYearId?: string; status?: string; studentId?: string; page: number }

export const useCertificates = (f: CertificateFilters) => {
  const p = new URLSearchParams({ page: String(f.page), pageSize: '20' });
  for (const k of ['search', 'academicYearId', 'status', 'studentId'] as const) if (f[k]) p.set(k, f[k]!);
  return useQuery({ queryKey: ['certificates', f], queryFn: () => api<Paginated<CertificateDto>>(`/certificates?${p}`), placeholderData: keepPreviousData });
};

const certPath = (studentId: string, year: string, purpose: string, format: 'pdf' | 'html') =>
  `/students/${studentId}/certificate?year=${encodeURIComponent(year)}&format=${format}${purpose ? `&purpose=${encodeURIComponent(purpose)}` : ''}`;

export const previewCertificate = (studentId: string, year: string, purpose = '') => openDocument(certPath(studentId, year, purpose, 'html'));

export function useIssueCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, year, purpose = '' }: { studentId: string; year: string; purpose?: string }) => {
      if (!(await openDocument(certPath(studentId, year, purpose, 'pdf'), `certificat-${year}.pdf`))) throw new Error('Émission impossible');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certificates'] }),
  });
}

export const openDuplicate = (c: CertificateDto) => openDocument(`/certificates/${c.id}/pdf`, `certificat-${c.number}.pdf`);

export function useRevokeCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api(`/certificates/${id}/revoke`, { method: 'POST', body: { reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certificates'] }),
  });
}

/** Vérification publique : appel sans jeton. */
export const useVerification = (code: string) =>
  useQuery({
    queryKey: ['verify', code],
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/public/verify/${encodeURIComponent(code)}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Erreur');
      return body.result as VerificationResult;
    },
  });
