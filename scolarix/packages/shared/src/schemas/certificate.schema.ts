import { z } from 'zod';

export const certificateQuerySchema = z.object({
  /** Libellé de l'année : 2026-2027 */
  year: z.string().regex(/^\d{4}-\d{4}$/, 'Format attendu : 2026-2027'),
  /** Motif facultatif imprimé sur le certificat (bourse, stage, visa…) */
  purpose: z.string().trim().max(150).optional(),
  /** html = aperçu sans émission (aucun numéro consommé) */
  format: z.enum(['pdf', 'html']).default('pdf'),
});

export const listCertificatesQuerySchema = z.object({
  search: z.string().trim().optional(),
  schoolId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: z.enum(['VALIDE', 'ANNULE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListCertificatesQuery = z.output<typeof listCertificatesQuerySchema>;

export const revokeCertificateSchema = z.object({
  reason: z.string().trim().min(3, 'Indiquez le motif (3 caractères minimum)').max(300),
});

/** Code de vérification : 10 caractères sans 0/O/1/I. */
export const verificationCodeParam = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{10}$/, 'Code de vérification invalide'),
});
