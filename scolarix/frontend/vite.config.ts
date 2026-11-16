import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    // Les appels /api sont relayés vers le backend : même origine → cookie de session OK
    proxy: { '/api': 'http://localhost:4000' },
  },
});
