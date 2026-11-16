import { readFileSync } from 'node:fs';

/** Variables de .env.test : les tests utilisent une base séparée (scolarix_test). */
export const testEnv: Record<string, string> = Object.fromEntries(
  readFileSync(new URL('../.env.test', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
