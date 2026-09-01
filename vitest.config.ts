import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    // Em Vitest 4, environmentMatchGlobs foi removido.
    // Testes que precisam de ambiente node devem usar o docblock:
    // // @vitest-environment node
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['lib/**/*.{ts,tsx}', 'app/api/**/*.{ts,tsx}'],
      exclude: ['**/*.d.ts', '**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
      thresholds: {
        lines: 20,
        functions: 15,
        branches: 15,
        statements: 20,
      },
    },
    // Timeout maior para testes assíncronos
    testTimeout: 10000,
    // Incluir apenas arquivos de teste
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Excluir pastas que não devem ser testadas
    exclude: [
      'node_modules',
      '.next',
      'prisma',
      'scripts',
      'FUNCIONALIDADES_FUTURAS',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
