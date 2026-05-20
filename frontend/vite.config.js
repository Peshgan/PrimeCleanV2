import { defineConfig } from 'vite';
import compression from 'vite-plugin-compression';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  root: '.',
  publicDir: 'motion',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      input: 'index.html',
    },
  },

  plugins: [
    // Brotli + Gzip for text assets
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
    }),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
    }),

    // Legacy browser support (Safari 12+, iOS 12+)
    legacy({
      targets: ['> 0.5%', 'last 2 versions', 'Safari >= 12', 'iOS >= 12', 'not dead'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
  ],

  server: {
    port: 3000,
    open: false,
  },
});
