import type { BrowserContext } from '@playwright/test';
import { SignJWT } from 'jose';

export const E2E_BASE_URL = 'http://127.0.0.1:3000';
export const E2E_JWT_SECRET = 'e2e-secret-key-for-jwt-signing-minimum-32-chars';
export const E2E_COURSE_ID = 'e2e-course-active';

export const E2E_IDS = {
  adminUser: 'e2e-admin-user',
  activeUser: 'e2e-active-user',
  expiredUser: 'e2e-expired-user',
  activeEnrollment: 'e2e-active-enrollment',
  expiredEnrollment: 'e2e-expired-enrollment',
  commonDocument: 'e2e-common-document',
  privateDocument: 'e2e-private-document',
} as const;

export const E2E_USERS = {
  admin: {
    userId: E2E_IDS.adminUser,
    role: 'admin' as const,
    email: 'e2e-admin@example.test',
    name: 'Administrador E2E',
  },
  active: {
    userId: E2E_IDS.activeUser,
    role: 'student' as const,
    email: 'e2e-active@example.test',
    name: 'Aluno Ativo E2E',
  },
  expired: {
    userId: E2E_IDS.expiredUser,
    role: 'student' as const,
    email: 'e2e-expired@example.test',
    name: 'Aluno Expirado E2E',
  },
} as const;

const DEFAULT_LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/barral_e2e';

interface E2EDatabaseEnvironment {
  DATABASE_URL?: string;
  TEST_DATABASE_URL?: string;
}

function isLocalDatabase(databaseUrl: string): boolean {
  const hostname = new URL(databaseUrl).hostname;
  return hostname === '127.0.0.1' || hostname === 'localhost';
}

/**
 * Impede que os testes E2E reutilizem DATABASE_URL remota por acidente.
 * Banco remoto só é aceito quando fornecido explicitamente como
 * TEST_DATABASE_URL; DATABASE_URL isolada precisa apontar para localhost.
 */
export function resolveE2EDatabaseUrl(
  env: E2EDatabaseEnvironment = {
    DATABASE_URL: process.env.DATABASE_URL,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  },
): string {
  if (env.TEST_DATABASE_URL) {
    return env.TEST_DATABASE_URL;
  }

  const databaseUrl = env.DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL;
  if (!isLocalDatabase(databaseUrl)) {
    throw new Error(
      'E2E recusado: banco remoto deve ser informado exclusivamente por TEST_DATABASE_URL.',
    );
  }

  return databaseUrl;
}

export async function authenticateAs(
  context: BrowserContext,
  user: (typeof E2E_USERS)[keyof typeof E2E_USERS],
): Promise<void> {
  const secret = new TextEncoder().encode(E2E_JWT_SECRET);
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);

  await context.addCookies([
    {
      name: 'auth-token',
      value: token,
      url: E2E_BASE_URL,
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
}
