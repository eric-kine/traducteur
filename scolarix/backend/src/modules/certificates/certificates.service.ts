import type { Prisma } from '@prisma/client';
import type { CertificateData, CertificateDto, ListCertificatesQuery, VerificationResult } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { nextCounter } from '../../common/utils/counter';
import { fromDate } from '../../common/utils/dates';
import { newVerificationCode, verificationUrl } from '../../common/utils/verification';
import type { AuthUser } from '../../common/types';
import { assertCanManageSchool, assertSchoolAccess, getSchoolScope } from '../../common/middlewares/school-scope';
import { htmlToPdf } from '../../pdf/pdf.service';
import { qrSvg } from '../../pdf/qr';
import { renderCertificate } from '../../pdf/templates/certificate';

/** Statuts d'inscription qui ne permettent pas de délivrer un certificat. */
const BLOCKING_ENROLLMENT = { EN_ATTENTE: "l'inscription est encore en attente", ANNULE: "l'inscription est annulée" } as const;
/** Statuts d'étudiant bloquants pour l'année en cours. */
const BLOCKING_STUDENT = { SUSPENDU: "l'étudiant est suspendu", EXCLU: "l'étudiant est exclu" } as const;

/** Rassemble les données du certificat (identité, école, niveau, année…). */
async function buildData(user: AuthUser, studentId: string, yearLabel: string, purpose: string | undefined) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw AppError.notFound('Étudiant introuvable');
  assertSchoolAccess(user, student.schoolId);

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, academicYear: { label: yearLabel } },
    include: { academicYear: true, level: true, specialty: true },
  });
  if (!enrollment) throw AppError.notFound(`Aucune inscription pour l'année ${yearLabel}`);

  const isPastYear = enrollment.academicYear.endDate < new Date();
  const blockE = BLOCKING_ENROLLMENT[enrollment.status as keyof typeof BLOCKING_ENROLLMENT];
  if (blockE) throw AppError.badRequest(`Certificat impossible : ${blockE}`);
  const blockS = BLOCKING_STUDENT[student.status as keyof typeof BLOCKING_STUDENT];
  if (blockS && !isPastYear) throw AppError.badRequest(`Certificat impossible : ${blockS}`);

  const [institute, school] = await Promise.all([
    prisma.institute.findFirst({ orderBy: { createdAt: 'asc' } }),
    prisma.school.findUniqueOrThrow({ where: { id: student.schoolId } }),
  ]);
  if (!institute) throw AppError.badRequest("Configurez d'abord l'institut");

  const data: CertificateData = {
    number: 'CS-' + yearLabel.slice(0, 4) + '-?????',
    orderNumber: 0,
    verificationCode: null,
    verificationUrl: null,
    issuedAt: new Date().toISOString(),
    purpose: purpose || null,
    institute: {
      name: institute.name, acronym: institute.acronym, address: institute.address, city: institute.city, country: institute.country,
      phone: institute.phone, email: institute.email, website: institute.website, directorName: institute.directorName,
    },
    school: { code: school.code, name: school.name, directorName: school.directorName },
    student: {
      matricule: student.matricule, firstName: student.firstName, lastName: student.lastName, gender: student.gender,
      birthDate: fromDate(student.birthDate), birthPlace: student.birthPlace, nationality: student.nationality,
    },
    academicYear: { label: enrollment.academicYear.label, startDate: fromDate(enrollment.academicYear.startDate), endDate: fromDate(enrollment.academicYear.endDate) },
    level: { code: enrollment.level.code, name: enrollment.level.name, cycle: enrollment.level.cycle },
    specialty: enrollment.specialty ? { code: enrollment.specialty.code, name: enrollment.specialty.name, diplomaTitle: enrollment.specialty.diplomaTitle } : null,
    isRepeating: enrollment.isRepeating,
    isPastYear,
  };
  return { data, student, enrollment };
}

/** Aperçu HTML : aucun numéro consommé, rien n'est enregistré. */
export async function preview(user: AuthUser, studentId: string, yearLabel: string, purpose?: string) {
  const { data } = await buildData(user, studentId, yearLabel, purpose);
  return renderCertificate(data, { preview: true });
}

/**
 * Émission : numéro d'ordre séquentiel dans l'année (compteur atomique),
 * code de vérification + QR code, enregistrement de l'historique avec la copie
 * exacte des données imprimées, puis génération du PDF.
 */
export async function issue(user: AuthUser, studentId: string, yearLabel: string, purpose?: string) {
  const { student } = await buildData(user, studentId, yearLabel, purpose);
  assertCanManageSchool(user, student.schoolId);
  return issueChecked(user, studentId, yearLabel, purpose);
}

/** Émission demandée par l'étudiant lui-même (Mon espace) : l'appelant a vérifié que c'est bien sa fiche. */
export const issueForSelf = (user: AuthUser, studentId: string, yearLabel: string) => issueChecked(user, studentId, yearLabel, 'Demande en ligne de l’étudiant');

async function issueChecked(user: AuthUser, studentId: string, yearLabel: string, purpose?: string) {
  const { data, enrollment } = await buildData(user, studentId, yearLabel, purpose);

  const year = yearLabel.slice(0, 4);
  const cert = await prisma.$transaction(async (tx) => {
    const orderNumber = await nextCounter(`certificate:${year}`, tx);
    data.orderNumber = orderNumber;
    data.number = `CS-${year}-${String(orderNumber).padStart(5, '0')}`;
    data.verificationCode = newVerificationCode();
    data.verificationUrl = verificationUrl(data.verificationCode);
    return tx.certificate.create({
      data: {
        orderNumber,
        number: data.number,
        verificationCode: data.verificationCode,
        purpose: data.purpose,
        snapshot: JSON.parse(JSON.stringify(data)),
        studentId,
        enrollmentId: enrollment.id,
        academicYearId: enrollment.academicYearId,
        issuedById: user.id,
      },
    });
  });
  const pdf = await htmlToPdf(renderCertificate(data, { qr: await qrSvg(data.verificationUrl!) }));
  return { pdf, number: cert.number, id: cert.id, filename: `certificat-${cert.number}.pdf` };
}

const listInclude = {
  student: { select: { id: true, matricule: true, firstName: true, lastName: true, schoolId: true, school: { select: { code: true, name: true } } } },
  enrollment: { select: { level: { select: { code: true, name: true } }, specialty: { select: { code: true } } } },
  academicYear: { select: { label: true } },
  issuedBy: { select: { firstName: true, lastName: true } },
} as const;
type Row = Prisma.CertificateGetPayload<{ include: typeof listInclude }>;

const toDto = (c: Row): CertificateDto => ({
  id: c.id,
  number: c.number,
  orderNumber: c.orderNumber,
  verificationCode: c.verificationCode,
  purpose: c.purpose,
  status: c.status,
  issuedAt: c.issuedAt.toISOString(),
  revokedAt: c.revokedAt?.toISOString() ?? null,
  revokedReason: c.revokedReason,
  issuedBy: c.issuedBy ? `${c.issuedBy.firstName} ${c.issuedBy.lastName}` : null,
  student: { id: c.student.id, matricule: c.student.matricule, firstName: c.student.firstName, lastName: c.student.lastName },
  school: c.student.school,
  level: `${c.enrollment.level.code} — ${c.enrollment.level.name}`,
  specialty: c.enrollment.specialty?.code ?? null,
  academicYear: c.academicYear.label,
});

/** Historique des certificats émis (le plus récent en premier). */
export async function list(user: AuthUser, q: ListCertificatesQuery) {
  const scope = getSchoolScope(user);
  if (scope && q.schoolId && q.schoolId !== scope) throw AppError.forbidden();
  const schoolId = scope ?? q.schoolId;
  const where: Prisma.CertificateWhereInput = {
    ...(q.academicYearId && { academicYearId: q.academicYearId }),
    ...(q.studentId && { studentId: q.studentId }),
    ...(q.status && { status: q.status }),
    ...(schoolId && { student: { schoolId } }),
    ...(q.search && {
      OR: [
        { number: { contains: q.search, mode: 'insensitive' } },
        { student: { matricule: { contains: q.search, mode: 'insensitive' } } },
        { student: { lastName: { contains: q.search, mode: 'insensitive' } } },
        { student: { firstName: { contains: q.search, mode: 'insensitive' } } },
      ],
    }),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.certificate.findMany({ where, include: listInclude, orderBy: { issuedAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.certificate.count({ where }),
  ]);
  return { data: rows.map(toDto), page: q.page, pageSize: q.pageSize, total };
}

async function findOrFail(id: string) {
  const c = await prisma.certificate.findUnique({ where: { id }, include: listInclude });
  if (!c) throw AppError.notFound('Certificat introuvable');
  return c;
}

/** Duplicata : PDF régénéré à l'identique depuis la copie enregistrée (même numéro, même code). */
export async function duplicate(user: AuthUser, id: string) {
  const c = await findOrFail(id);
  assertSchoolAccess(user, c.student.schoolId);
  const data = c.snapshot as unknown as CertificateData;
  const pdf = await htmlToPdf(renderCertificate(data, { qr: await qrSvg(data.verificationUrl!), duplicate: true, revoked: c.status === 'ANNULE' }));
  return { pdf, filename: `certificat-${c.number}-duplicata.pdf` };
}

/** Annulation (erreur, fraude…) : le certificat reste dans l'historique et la vérification en ligne indique "annulé". */
export async function revoke(user: AuthUser, id: string, reason: string) {
  const c = await findOrFail(id);
  assertCanManageSchool(user, c.student.schoolId);
  if (c.status === 'ANNULE') throw AppError.badRequest('Ce certificat est déjà annulé');
  return toDto(
    await prisma.certificate.update({
      where: { id },
      data: { status: 'ANNULE', revokedAt: new Date(), revokedReason: reason, revokedById: user.id },
      include: listInclude,
    }),
  );
}

/**
 * Vérification publique (sans connexion) d'un certificat ou d'un relevé à partir
 * de son code. Ne renvoie que le minimum nécessaire pour comparer avec le papier.
 */
export async function verify(code: string): Promise<VerificationResult> {
  const cert = await prisma.certificate.findUnique({ where: { verificationCode: code } });
  if (cert) {
    const d = cert.snapshot as unknown as CertificateData;
    return {
      valid: cert.status === 'VALIDE',
      type: 'CERTIFICAT_SCOLARITE',
      reference: cert.number,
      status: cert.status,
      issuedAt: cert.issuedAt.toISOString(),
      revokedAt: cert.revokedAt?.toISOString() ?? null,
      student: { fullName: `${d.student.lastName.toUpperCase()} ${d.student.firstName}`, matricule: d.student.matricule },
      school: d.school.name,
      institute: d.institute.name,
      level: d.level.name + (d.specialty ? ` — ${d.specialty.name}` : ''),
      academicYear: d.academicYear.label,
    };
  }
  const doc = await prisma.generatedDocument.findUnique({ where: { verificationCode: code } });
  if (doc?.snapshot) {
    const d = doc.snapshot as { student: { lastName: string; firstName: string; matricule: string }; school: { name: string }; institute: { name: string }; level: { name: string }; specialty: { name: string } | null; academicYear: string };
    return {
      valid: true,
      type: 'RELEVE_NOTES',
      reference: doc.reference,
      status: 'VALIDE',
      issuedAt: doc.issuedAt.toISOString(),
      revokedAt: null,
      student: { fullName: `${d.student.lastName.toUpperCase()} ${d.student.firstName}`, matricule: d.student.matricule },
      school: d.school.name,
      institute: d.institute.name,
      level: d.level.name + (d.specialty ? ` — ${d.specialty.name}` : ''),
      academicYear: d.academicYear,
    };
  }
  throw AppError.notFound('Aucun document ne correspond à ce code');
}
