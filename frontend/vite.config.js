import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    coverage: {
      reporter: ['text', 'lcov'],
      exclude: ['node_modules/', 'src/test/', 'e2e/**'],
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});