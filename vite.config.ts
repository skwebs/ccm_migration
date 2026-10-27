import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // This app is served from the domain root, not /credit-card/.
  base: '/',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
});
