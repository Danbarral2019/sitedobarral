import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    // Usar ambiente node para testes de API e JWT
    environmentMatchGlobs: [
      ['lib/__tests__/auth.test.ts', 'node'],
      ['app/api/**/*.test.ts', 'node'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '.next/',
        'prisma/',
        'scripts/',
        'public/',
        // Arquivos de documentação
        '**/*.md',
        // Funcionalidades futuras não testadas ainda
        'FUNCIONALIDADES_FUTURAS/',
      ],
      // Thresholds desativados inicialmente
      // TODO: Aumentar gradualmente conforme mais testes forem adicionados
      // Meta futura: lines 80%, functions 80%, branches 70%, statements 80%
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
