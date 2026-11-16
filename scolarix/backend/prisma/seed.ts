/**
 * Données initiales : l'institut et un premier compte administrateur.
 * Lancement : npm run db:seed (le script peut être relancé sans créer de doublons).
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@scolarix.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345';

  const institute = await prisma.institute.findFirst();
  if (!institute) {
    await prisma.institute.create({ data: { name: 'Institut Supérieur Scolarix', acronym: 'ISS' } });
    console.log('🏛️  Institut créé');
  }

  const admin = await prisma.user.findUnique({ where: { email } });
  if (!admin) {
    await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        firstName: 'Admin',
        lastName: 'Scolarix',
        role: 'ADMIN',
      },
    });
    console.log(`👤 Administrateur créé : ${email}`);
  } else {
    console.log(`👤 Administrateur déjà présent : ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
