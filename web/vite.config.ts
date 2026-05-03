import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    fs: {
      // Allow serving files from the data directory outside the project root
      allow: ['..']
    }
  }
});
