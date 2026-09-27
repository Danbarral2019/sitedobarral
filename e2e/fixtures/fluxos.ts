import { randomBytes, randomInt } from 'node:crypto';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { hasE2ERedis, resolveE2EDatabaseUrl } from './database';

export const E2E_PASSWORD = 'Senha-E2E-lancamento-1';

let prisma: PrismaClient | null = null;

/**
 * Cliente Prisma dos specs, sempre apontado para o banco descartável. Não
 * importa `lib/prisma`, que lê DATABASE_URL e poderia alcançar a produção.
 */
export function e2ePrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      adapter: new PrismaNeon({ connectionString: resolveE2EDatabaseUrl() }),
    });
  }
  return prisma;
}

export async function disconnectE2EPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

/** Email exclusivo por teste, para rodar em paralelo sem colisão. */
export function uniqueEmail(fluxo: string): string {
  return `e2e-${fluxo}-${Date.now()}-${randomBytes(3).toString('hex')}@example.test`;
}

/**
 * Registro, login e reenvio têm limite por IP de 5 a 10 chamadas por minuto.
 * Um IP fictício por teste impede que testes paralelos consumam a cota uns dos
 * outros; o limite em si continua ativo.
 */
export async function isolateClientIp(context: BrowserContext): Promise<void> {
  const ip = `10.${randomInt(0, 256)}.${randomInt(0, 256)}.${randomInt(1, 255)}`;
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': ip });
}

/**
 * Sem Redis, as rotas de autenticação respondem 429 (fail-closed). Na CI isso
 * é erro de configuração; localmente, o teste é pulado com o motivo.
 */
export function requireRateLimitBackend(): void {
  if (hasE2ERedis()) return;
  const motivo =
    'Rotas de autenticação exigem Redis (rate limit fail-closed). ' +
    'Defina E2E_UPSTASH_REDIS_REST_URL/TOKEN apontando para um emulador local.';
  if (process.env.CI) {
    throw new Error(motivo);
  }
  test.skip(true, motivo);
}

export async function registerViaUi(
  page: Page,
  dados: { name: string; email: string; qrCode?: string },
): Promise<void> {
  await page.goto(dados.qrCode ? `/registro?qr=${dados.qrCode}` : '/registro');
  await page.locator('#name').fill(dados.name);
  await page.locator('#email').fill(dados.email);
  await page.locator('#password').fill(E2E_PASSWORD);
  await page.locator('#confirmPassword').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Criar Conta' }).click();
  await expect(page).toHaveURL(/\/registro\/confirmacao/);
}

export async function loginViaUi(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

/** Lê o token de verificação no banco descartável, no lugar da caixa de entrada. */
export async function readVerificationToken(email: string): Promise<string> {
  const user = await e2ePrisma().user.findUniqueOrThrow({
    where: { email: email.toLowerCase() },
    select: { verificationToken: true },
  });
  if (!user.verificationToken) {
    throw new Error(`Usuário ${email} sem token de verificação pendente.`);
  }
  return user.verificationToken;
}
