import { z } from 'zod';

/**
 * Lecture et validation des variables d'environnement au démarrage.
 * Si une variable manque, l'application s'arrête avec un message clair
 * plutôt que de planter plus tard de façon obscure.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit faire au moins 32 caractères'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /** Dossier des fichiers envoyés (photos). Hors du dépôt Git. */
  UPLOAD_DIR: z.string().default('./uploads'),
  /** Adresse publique du site : sert à construire le lien du QR code de vérification. */
  PUBLIC_APP_URL: z.string().url().default('http://localhost:5173'),
  /** Cookie de session réservé au HTTPS. Par défaut : oui en production. Mettre "false" UNIQUEMENT pour un essai local en HTTP. */
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  /** Version « tout-en-un » : dossier du site compilé, servi par l'API (même adresse). */
  FRONTEND_DIR: z.string().optional(),
});

// Sur Render, l'adresse publique du service est fournie automatiquement (RENDER_EXTERNAL_URL) :
// elle sert de valeur par défaut pour PUBLIC_APP_URL et CORS_ORIGIN.
if (process.env.RENDER_EXTERNAL_URL) {
  process.env.PUBLIC_APP_URL ||= process.env.RENDER_EXTERNAL_URL;
  process.env.CORS_ORIGIN ||= process.env.RENDER_EXTERNAL_URL;
}

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Configuration invalide (.env) :');
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const cookieSecure = env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProduction;
