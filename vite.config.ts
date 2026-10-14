import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/chessview/',
  build: {
    sourcemap: true,
    rollupOptions: { input: {
      chessview: fileURLToPath(new URL('./index.html', import.meta.url)),
      holes: fileURLToPath(new URL('./holes.html', import.meta.url)),
    } },
  },
});
