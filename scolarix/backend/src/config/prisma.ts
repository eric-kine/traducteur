import { PrismaClient } from '@prisma/client';

/** Client Prisma unique pour toute l'application. */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
