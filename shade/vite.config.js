import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { host: true },
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 900 }
});
