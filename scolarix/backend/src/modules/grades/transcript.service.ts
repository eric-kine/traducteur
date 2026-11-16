import crypto from 'node:crypto';
import type { TranscriptData } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { nextCounter } from '../../common/utils/counter';
import { fromDate } from '../../common/utils/dates';
import type { AuthUser } from '../../common/types';
import { assertSchoolAccess } from '../../common/middlewares/school-scope';
import { htmlToPdf } from '../../pdf/pdf.service';
import { renderTranscript } from '../../pdf/templates/transcript';
import { computeEnrollment, loadEnrollment } from './results.service';

/** Code court lisible (sans 0/O, 1/I) pour vérifier l'authenticité d'un document. */
function verificationCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(10), (b) => alphabet[b % alphabet.length]).join('');
}

/** Rassemble toutes les données du relevé d'un étudiant pour une année (ex. "2026-2027"). */
export async function buildTranscriptData(user: AuthUser, studentId: string, yearLabel: string): Promise<TranscriptData & { enrollmentId: string }> {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
  if (!student) throw AppError.notFound('Étudiant introuvable');
  assertSchoolAccess(user, student.schoolId);

  const e = await loadEnrollment({ studentId, academicYear: { label: yearLabel } });
  if (!e) throw AppError.notFound(`Aucune inscription pour l'année ${yearLabel}`);
  const [institute, school, results] = await Promise.all([
    prisma.institute.findFirst({ orderBy: { createdAt: 'asc' } }),
    prisma.school.findUniqueOrThrow({ where: { id: e.student.schoolId } }),
    computeEnrollment(e),
  ]);
  if (!institute) throw AppError.badRequest("Configurez d'abord l'institut");

  return {
    enrollmentId: e.id,
    reference: null,
    verificationCode: null,
    issuedAt: new Date().toISOString(),
    institute: {
      name: institute.name, acronym: institute.acronym, address: institute.address, city: institute.city, country: institute.country,
      phone: institute.phone, email: institute.email, website: institute.website, directorName: institute.directorName,
    },
    school: { code: school.code, name: school.name, directorName: school.directorName },
    student: {
      matricule: e.student.matricule, firstName: e.student.firstName, lastName: e.student.lastName,
      birthDate: fromDate(e.student.birthDate), birthPlace: e.student.birthPlace, gender: e.student.gender,
    },
    academicYear: e.academicYear.label,
    level: { code: e.level.code, name: e.level.name },
    specialty: e.specialty ? { code: e.specialty.code, name: e.specialty.name, diplomaTitle: e.specialty.diplomaTitle } : null,
    semesters: results.semesters.map((s) => ({ ...s, units: s.units.map(({ semester: _s, ...u }) => u) })),
    year: results.year,
    deliberatedAt: e.deliberatedAt?.toISOString() ?? null,
    isProvisional: !e.deliberatedAt,
  };
}

/**
 * Émet un relevé : aperçu HTML (sans enregistrement) ou PDF officiel.
 * Chaque PDF reçoit une référence unique (RN-2026-000001) et un code de
 * vérification, et son contenu exact est archivé (GeneratedDocument.snapshot).
 */
export async function issueTranscript(user: AuthUser, studentId: string, yearLabel: string, format: 'pdf' | 'html') {
  const { enrollmentId, ...data } = await buildTranscriptData(user, studentId, yearLabel);
  if (format === 'html') return { html: renderTranscript(data) };

  data.reference = `RN-${yearLabel.slice(0, 4)}-${String(await nextCounter(`transcript:${yearLabel.slice(0, 4)}`)).padStart(6, '0')}`;
  data.verificationCode = verificationCode();
  const pdf = await htmlToPdf(renderTranscript(data));
  await prisma.generatedDocument.create({
    data: {
      type: 'RELEVE_NOTES',
      reference: data.reference,
      verificationCode: data.verificationCode,
      issuedById: user.id,
      snapshot: JSON.parse(JSON.stringify(data)),
      studentId,
      enrollmentId,
    },
  });
  const filename = `releve-${data.student.matricule}-${yearLabel}.pdf`;
  return { pdf, filename, reference: data.reference };
}
