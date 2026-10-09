import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import manifest from './package.json' with { type: 'json' };

export default defineConfig({
  root: 'src/renderer',
  base: './',
  publicDir: '../../resources/visuals',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(manifest.version) },
  build: { outDir: '../../dist/renderer', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5173, strictPort: true }
});
