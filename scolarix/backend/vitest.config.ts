import { defineConfig } from 'vitest/config';
import { testEnv } from './tests/test-env';

export default defineConfig({
  test: {
    env: testEnv,
    globalSetup: ['tests/global-setup.ts'],
    fileParallelism: false, // une seule base de test partagée
  },
});
