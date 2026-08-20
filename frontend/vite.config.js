import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    isolate: true,
    pool: 'forks',
    restoreMocks: true,
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    coverage: {
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['node_modules/', 'src/test/','e2e/**',],
      provider: 'v8',
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 60,
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});