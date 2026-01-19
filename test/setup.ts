/**
 * Setup global para testes Vitest
 *
 * Este arquivo é executado antes de cada arquivo de teste.
 * Configura matchers do jest-dom, cleanup automático e variáveis de ambiente.
 */

import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { webcrypto } from 'crypto';

// Polyfill para Web Crypto API (necessário para jose)
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as unknown as Crypto;
}

// Adiciona matchers do jest-dom ao expect do Vitest
// Permite usar: expect(element).toBeInTheDocument(), toHaveClass(), etc.
expect.extend(matchers);

// Limpa o DOM após cada teste para evitar vazamento de estado
afterEach(() => {
  cleanup();
});

// Mock de variáveis de ambiente para testes
process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing-minimum-32-chars';
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';

// Mock do logger para não poluir output dos testes
vi.mock('@/lib/logger', () => ({
  apiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  authLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock do Prisma para testes unitários
// Testes de integração devem usar um banco de teste real
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    document: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    qRCode: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Declaração de tipos para TypeScript reconhecer os matchers do jest-dom
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends jest.Matchers<void, T> {}
}
