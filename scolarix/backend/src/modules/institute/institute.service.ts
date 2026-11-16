import type { z } from 'zod';
import type { instituteSchema } from '@scolarix/shared';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';

type InstituteData = z.output<typeof instituteSchema>;

/** L'institut unique (créé par le seed ou au premier enregistrement). */
export async function get() {
  const institute = await prisma.institute.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!institute) throw AppError.notFound("L'institut n'est pas encore configuré");
  return institute;
}

export async function getId(): Promise<string> {
  const institute = await prisma.institute.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
  if (!institute) throw AppError.badRequest("Configurez d'abord l'institut (page Établissement)");
  return institute.id;
}

/** Crée ou met à jour l'institut (une seule ligne). */
export async function upsert(data: InstituteData) {
  const existing = await prisma.institute.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
  return existing
    ? prisma.institute.update({ where: { id: existing.id }, data })
    : prisma.institute.create({ data });
}
