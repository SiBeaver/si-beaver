import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND = 'http://10.1.1.40:7420';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': BACKEND,
      '^/[a-z0-9][a-z0-9-]*/api': { target: BACKEND, changeOrigin: true },
      '^/[a-z0-9][a-z0-9-]*/mcp': { target: BACKEND, changeOrigin: true },
    },
  },
});
