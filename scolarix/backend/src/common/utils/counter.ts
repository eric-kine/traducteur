import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Incrémente un compteur et renvoie la nouvelle valeur, de façon atomique :
 * deux créations simultanées n'obtiennent jamais le même numéro.
 */
export async function nextCounter(key: string, db: Db = prisma): Promise<number> {
  const rows = await db.$queryRaw<{ value: number }[]>`
    INSERT INTO "counters" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "counters"."value" + 1
    RETURNING "value"`;
  return rows[0]!.value;
}

/** Matricule étudiant : EIT-2026-00042 */
export async function nextMatricule(schoolCode: string, year: number, db: Db = prisma) {
  const n = await nextCounter(`matricule:${schoolCode}:${year}`, db);
  return `${schoolCode}-${year}-${String(n).padStart(5, '0')}`;
}

/** Numéro enseignant : ENS-00007 */
export async function nextEmployeeNumber(db: Db = prisma) {
  return `ENS-${String(await nextCounter('teacher', db)).padStart(5, '0')}`;
}
