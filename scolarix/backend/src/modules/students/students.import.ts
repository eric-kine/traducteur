import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import {
  STUDENT_CSV_REQUIRED,
  studentFields,
  type CreateStudentData,
  type ImportReport,
  type ImportRowResult,
} from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import type { AuthUser } from '../../common/types';
import { assertCanManageSchool } from '../../common/middlewares/school-scope';
import { insertStudent } from './students.service';

export const MAX_IMPORT_ROWS = 2000;

/** "Prénom" → "prenom", "Date de naissance" → "date_de_naissance" */
const normalizeHeader = (h: string) =>
  h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** En-têtes alternatifs acceptés. */
const ALIASES: Record<string, string> = {
  nom_de_famille: 'nom', prenoms: 'prenom', genre: 'sexe',
  date_de_naissance: 'date_naissance', ne_le: 'date_naissance', naissance: 'date_naissance',
  lieu_de_naissance: 'lieu_naissance', ne_a: 'lieu_naissance',
  tel: 'telephone', mail: 'email', courriel: 'email', nationality: 'nationalite',
  parent: 'tuteur_nom', tuteur: 'tuteur_nom', telephone_tuteur: 'tuteur_telephone', email_tuteur: 'tuteur_email',
  code_niveau: 'niveau', code_specialite: 'specialite', filiere: 'specialite',
};

/** "15/03/2005", "15-03-2005" ou "2005-03-15" → "2005-03-15" */
export function parseCsvDate(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return null;
}

/** "M", "H", "Homme", "Masculin" → M ; "F", "Femme", "Féminin" → F */
export function parseGender(v: string): 'M' | 'F' | null {
  const s = normalizeHeader(v);
  if (['m', 'h', 'homme', 'masculin', 'garcon'].includes(s)) return 'M';
  if (['f', 'femme', 'feminin', 'fille'].includes(s)) return 'F';
  return null;
}

/** Lit le fichier : séparateur ";" (Excel français) ou "," détecté automatiquement, BOM UTF-8 ignoré. */
export function parseCsv(buffer: Buffer): Record<string, string>[] {
  const text = buffer.toString('utf8').replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  try {
    return parse(text, {
      delimiter,
      columns: (headers: string[]) => headers.map((h) => ALIASES[normalizeHeader(h)] ?? normalizeHeader(h)),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (e) {
    throw AppError.badRequest(`Fichier CSV illisible : ${(e as Error).message}`);
  }
}

const rowSchema = z.object(studentFields);
const key = (lastName: string, firstName: string, birthDate: string) =>
  `${normalizeHeader(lastName)}|${normalizeHeader(firstName)}|${birthDate}`;

/**
 * Import en masse.
 *  - dryRun = true  : on vérifie tout et on renvoie le rapport ligne par ligne, sans rien enregistrer.
 *  - dryRun = false : les lignes valides sont enregistrées en une seule transaction
 *    (tout ou rien) ; les lignes en erreur ou en doublon sont ignorées et listées.
 */
export async function importStudents(
  user: AuthUser,
  buffer: Buffer | undefined,
  opts: { schoolId: string; academicYearId?: string; dryRun: boolean },
): Promise<ImportReport> {
  if (!buffer?.length) throw AppError.badRequest('Aucun fichier reçu');
  assertCanManageSchool(user, opts.schoolId);
  const school = await prisma.school.findUnique({ where: { id: opts.schoolId }, select: { id: true } });
  if (!school) throw AppError.badRequest('École introuvable');
  if (opts.academicYearId && !(await prisma.academicYear.findUnique({ where: { id: opts.academicYearId } }))) {
    throw AppError.badRequest('Année académique introuvable');
  }

  const records = parseCsv(buffer);
  if (!records.length) throw AppError.badRequest('Le fichier ne contient aucune ligne de données');
  if (records.length > MAX_IMPORT_ROWS) throw AppError.badRequest(`Maximum ${MAX_IMPORT_ROWS} lignes par import`);
  const missing = STUDENT_CSV_REQUIRED.filter((c) => !(c in records[0]!));
  if (missing.length) throw AppError.badRequest(`Colonnes obligatoires manquantes : ${missing.join(', ')}`);

  // Référentiels de l'école (codes → id)
  const [levels, specialties, existing] = await Promise.all([
    prisma.level.findMany({ where: { schoolId: school.id }, select: { id: true, code: true } }),
    prisma.specialty.findMany({ where: { schoolId: school.id }, select: { id: true, code: true } }),
    prisma.student.findMany({ where: { schoolId: school.id }, select: { firstName: true, lastName: true, birthDate: true } }),
  ]);
  const levelByCode = new Map(levels.map((l) => [l.code, l.id]));
  const specialtyByCode = new Map(specialties.map((s) => [s.code, s.id]));
  const seen = new Set(existing.map((s) => key(s.lastName, s.firstName, s.birthDate.toISOString().slice(0, 10))));

  const rows: ImportRowResult[] = [];
  const toInsert: { result: ImportRowResult; data: CreateStudentData }[] = [];

  records.forEach((r, i) => {
    const result: ImportRowResult = { line: i + 2, status: 'ok', name: `${r.nom ?? ''} ${r.prenom ?? ''}`.trim(), errors: [] };
    rows.push(result);

    const birthDate = r.date_naissance ? parseCsvDate(r.date_naissance) : null;
    if (r.date_naissance && !birthDate) result.errors.push(`date_naissance : « ${r.date_naissance} » n'est pas une date (JJ/MM/AAAA)`);
    const gender = r.sexe ? parseGender(r.sexe) : null;
    if (r.sexe && !gender) result.errors.push(`sexe : « ${r.sexe} » (attendu M ou F)`);

    const parsed = rowSchema.safeParse({
      lastName: r.nom, firstName: r.prenom, gender, birthDate: birthDate ?? r.date_naissance,
      birthPlace: r.lieu_naissance, nationality: r.nationalite, email: r.email, phone: r.telephone, address: r.adresse,
      guardianName: r.tuteur_nom, guardianRelation: r.tuteur_lien, guardianPhone: r.tuteur_telephone, guardianEmail: r.tuteur_email,
    });
    if (!parsed.success) {
      const labels: Record<string, string> = { lastName: 'nom', firstName: 'prenom', gender: 'sexe', birthDate: 'date_naissance', birthPlace: 'lieu_naissance', email: 'email', guardianEmail: 'tuteur_email' };
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        if ((field === 'birthDate' && r.date_naissance && !birthDate) || (field === 'gender' && r.sexe && !gender)) continue; // déjà signalé
        result.errors.push(`${labels[field] ?? field} : ${issue.message}`);
      }
    }

    // Inscription (colonnes niveau / specialite)
    let enrollment: CreateStudentData['enrollment'] = null;
    const levelCode = r.niveau?.toUpperCase();
    const specialtyCode = r.specialite?.toUpperCase();
    if (levelCode) {
      const levelId = levelByCode.get(levelCode);
      if (!levelId) result.errors.push(`niveau : code « ${r.niveau} » inconnu dans cette école`);
      if (!opts.academicYearId) result.errors.push("niveau : choisissez une année académique pour inscrire l'étudiant");
      let specialtyId: string | null = null;
      if (specialtyCode) {
        specialtyId = specialtyByCode.get(specialtyCode) ?? null;
        if (!specialtyId) result.errors.push(`specialite : code « ${r.specialite} » inconnu dans cette école`);
      }
      if (levelId && opts.academicYearId) enrollment = { academicYearId: opts.academicYearId, levelId, specialtyId };
    } else if (specialtyCode) {
      result.errors.push('specialite : renseignez aussi le niveau');
    }

    if (result.errors.length || !parsed.success) {
      result.status = 'error';
      return;
    }
    const k = key(parsed.data.lastName, parsed.data.firstName, parsed.data.birthDate);
    if (seen.has(k)) {
      result.status = 'duplicate';
      result.errors.push('Déjà présent (même nom, prénom et date de naissance)');
      return;
    }
    seen.add(k);
    toInsert.push({ result, data: { ...parsed.data, schoolId: school.id, enrollment } });
  });

  let imported = 0;
  if (!opts.dryRun && toInsert.length) {
    await prisma.$transaction(
      async (tx) => {
        for (const item of toInsert) {
          const s = await insertStudent(item.data, tx);
          item.result.matricule = s.matricule;
        }
      },
      { timeout: 120_000 },
    );
    imported = toInsert.length;
  }

  return {
    dryRun: opts.dryRun,
    total: rows.length,
    valid: toInsert.length,
    errors: rows.filter((r) => r.status === 'error').length,
    duplicates: rows.filter((r) => r.status === 'duplicate').length,
    imported,
    rows,
  };
}
