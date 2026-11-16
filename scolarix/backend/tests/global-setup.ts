import { execSync } from 'node:child_process';
import { testEnv } from './test-env';

/**
 * Applique les migrations sur la base de test (scolarix_test) avant les tests.
 * Non destructif : les tests vident eux-mêmes leurs tables (voir helpers.resetDb).
 */
export default function setup() {
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, ...testEnv } });
}
