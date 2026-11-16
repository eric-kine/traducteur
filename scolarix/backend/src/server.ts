import { env } from './config/env';
import { prisma } from './config/prisma';
import { createApp } from './app';

const server = createApp().listen(env.PORT, () => {
  console.log(`✅ API Scolarix démarrée sur http://localhost:${env.PORT}`);
});

// Arrêt propre (Ctrl+C, redémarrage de l'hébergeur)
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  });
}
