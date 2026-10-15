import { defineConfig } from 'vite';

const apiTarget = process.env.DG_API_ORIGIN ?? 'http://127.0.0.1:3000';

export default defineConfig({
  root: 'src/ui',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/facets': apiTarget,
      '/projects': apiTarget,
      '/records': apiTarget,
      '/search': apiTarget,
    },
  },
  build: {
    outDir: '../../dist/ui',
    emptyOutDir: false,
  },
});
