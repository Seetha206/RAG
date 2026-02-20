import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@':           resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages':      resolve(__dirname, 'src/pages'),
      '@store':      resolve(__dirname, 'src/store'),
      '@services':   resolve(__dirname, 'src/services'),
      '@utils':      resolve(__dirname, 'src/utils'),
      '@hooks':      resolve(__dirname, 'src/hooks'),
      '@types':      resolve(__dirname, 'src/types'),
      '@styles':     resolve(__dirname, 'src/styles'),
      '@assets':     resolve(__dirname, 'src/assets'),
      '@routes':     resolve(__dirname, 'src/routes'),
      '@i18n':       resolve(__dirname, 'src/i18n'),
      '@functions':  resolve(__dirname, 'src/functions'),
    },
  },
  server: { port: 3000 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: true,
  },
});
