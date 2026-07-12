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
      // Ratchet: thresholds calibrados ~1-2pts abaixo do nível atual do
      // RECORTE alcançável por testes (o v8 sem coverage.include mede só o
      // código que algum teste importa — ~69% stmts; a cobertura real de todo
      // lib/+app/ é ~21%). Mantidos pouco abaixo para o gate voltar a ser sinal
      // vivo (bloqueia regressão) sem quebrar pela flutuação do denominador.
      // A cada lote de testes, SUBIR estes números. Meta de longo prazo: 80/70.
      thresholds: {
        lines: 75,
        functions: 71,
        branches: 64,
        statements: 74,
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
