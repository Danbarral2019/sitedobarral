import type { BrowserContext } from '@playwright/test';
import { SignJWT } from 'jose';

export const E2E_BASE_URL = 'http://127.0.0.1:3000';
export const E2E_JWT_SECRET = 'e2e-secret-key-for-jwt-signing-minimum-32-chars';
export const E2E_COURSE_ID = 'e2e-course-active';

/**
 * Curso real do catálogo (`data/courses.ts`) usado pelos fluxos de lançamento.
 * O `'1'` citado no COURSE_IDS_REFERENCE.md não está no catálogo atual, e
 * matrícula em curso fora do catálogo não aparece na área restrita.
 */
export const E2E_CATALOG_COURSE = {
  id: '2',
  title: 'Planejamento das Contratações Públicas',
} as const;

export const E2E_QR_CODE = {
  id: 'e2e-qrcode-turma',
  code: 'e2e-qr-turma-lancamento',
  turma: 'Turma E2E',
  courseId: E2E_CATALOG_COURSE.id,
} as const;

/**
 * Segredo de assinatura do webhook usado só pelo dev server dos testes. Não é
 * credencial: os eventos são assinados localmente com
 * `stripe.webhooks.generateTestHeaderString` e nunca saem da máquina.
 */
export const E2E_STRIPE_WEBHOOK_SECRET = 'whsec_e2e_somente_para_testes_locais';
export const E2E_STRIPE_OFFLINE_KEY = 'sk_test_e2e_offline_sem_rede';

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

function isLocalHost(url: string): boolean {
  const hostname = new URL(url).hostname;
  return hostname === '127.0.0.1' || hostname === 'localhost';
}

function isLocalDatabase(databaseUrl: string): boolean {
  return isLocalHost(databaseUrl);
}

/**
 * Rotas de autenticação limitam tentativas com `failureMode: 'closed'`: sem
 * Redis, registro e login respondem 429. Os testes usam um Redis local (na CI,
 * o emulador REST do Upstash em container) e nunca o da produção, que o dev
 * server leria do `.env.local` se a variável ficasse ausente.
 */
export function resolveE2ERedisEnv(
  env: { E2E_UPSTASH_REDIS_REST_URL?: string; E2E_UPSTASH_REDIS_REST_TOKEN?: string } = {
    E2E_UPSTASH_REDIS_REST_URL: process.env.E2E_UPSTASH_REDIS_REST_URL,
    E2E_UPSTASH_REDIS_REST_TOKEN: process.env.E2E_UPSTASH_REDIS_REST_TOKEN,
  },
): { UPSTASH_REDIS_REST_URL: string; UPSTASH_REDIS_REST_TOKEN: string } {
  const url = env.E2E_UPSTASH_REDIS_REST_URL ?? '';
  const token = env.E2E_UPSTASH_REDIS_REST_TOKEN ?? '';
  if (url && !isLocalHost(url)) {
    throw new Error('E2E recusado: o Redis dos testes precisa ser local.');
  }
  // String vazia (e não ausência) impede o dev server de herdar o Redis de
  // produção do .env.local: o Next não sobrescreve variável já definida.
  return { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: url ? token : '' };
}

export function hasE2ERedis(): boolean {
  return Boolean(resolveE2ERedisEnv().UPSTASH_REDIS_REST_URL);
}

/**
 * Chave Stripe do dev server. Só aceita chave de teste; sem ela, usa uma chave
 * fictícia que basta para `constructEvent` validar assinaturas sem rede.
 */
export function resolveE2EStripeSecretKey(
  testKey: string | undefined = process.env.STRIPE_TEST_SECRET_KEY,
): string {
  if (!testKey) return E2E_STRIPE_OFFLINE_KEY;
  if (!testKey.startsWith('sk_test_')) {
    throw new Error('E2E recusado: STRIPE_TEST_SECRET_KEY precisa ser chave de teste (sk_test_).');
  }
  return testKey;
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

export interface E2EAuthUser {
  userId: string;
  role: 'admin' | 'student';
  email: string;
  name: string;
}

export async function authenticateAs(
  context: BrowserContext,
  user: E2EAuthUser,
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
