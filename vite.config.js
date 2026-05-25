import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir:    'dist',
    sourcemap: false,
    // PWA-safe: inline assets < 4kB, keep chunks predictable
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          react:   ['react', 'react-dom'],
          // Core engine bundle (lazy-loadable, not blocking initial paint)
          engine: [
            './src/core/storage.js',
            './src/core/companionCoreService.js',
          ],
        },
      },
    },
  },
});
