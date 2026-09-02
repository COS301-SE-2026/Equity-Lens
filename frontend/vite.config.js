import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    isolate: true,
    pool: 'forks',
    restoreMocks: true,
    globals: true,
    environment: 'jsdom',
    setupFiles: './test/setup.js',
    exclude :[
      '**/node_modules/**',
      '**/e2e/**',
      '**/test/nfr/**'
    ],
    coverage: {
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['node_modules/', 'src/test/','e2e/**',],
      provider: 'v8',
      thresholds: {
        lines: 50,
        functions: 50,
        statements: 50,
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});