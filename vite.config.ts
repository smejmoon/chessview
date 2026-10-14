import { defineConfig } from 'vite';

export default defineConfig({
  base: '/chessview/',
  build: {
    sourcemap: true,
    rollupOptions: { input: {
      chessview: 'index.html',
      holes: 'holes.html',
    } },
  },
});
