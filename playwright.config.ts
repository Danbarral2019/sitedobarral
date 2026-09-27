import { defineConfig, devices } from '@playwright/test';
import {
  E2E_BASE_URL,
  E2E_JWT_SECRET,
  E2E_STRIPE_WEBHOOK_SECRET,
  resolveE2EDatabaseUrl,
  resolveE2ERedisEnv,
  resolveE2EStripeSecretKey,
} from './e2e/fixtures/database';

const databaseUrl = resolveE2EDatabaseUrl();
const redisEnv = resolveE2ERedisEnv();

export default defineConfig({
  testDir: './e2e',
  globalSetup: './scripts/e2e-seed.ts',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  // O dev server compila cada rota no primeiro acesso; 5 s não bastam na CI.
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1',
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: databaseUrl,
      JWT_SECRET: E2E_JWT_SECRET,
      NEXT_PUBLIC_BASE_URL: E2E_BASE_URL,
      // Os fluxos de lançamento precisam das rotas reais, não da página de
      // pré-lançamento que o middleware serve quando a flag está ligada.
      COMING_SOON_ENABLED: 'false',
      // Sem chave, lib/email apenas registra o email no console do dev
      // server. A string vazia impede herdar a chave do .env.local.
      RESEND_API_KEY: '',
      STRIPE_SECRET_KEY: resolveE2EStripeSecretKey(),
      NEXT_PUBLIC_PIX_ENABLED: 'false',
      STRIPE_WEBHOOK_SECRET: E2E_STRIPE_WEBHOOK_SECRET,
      ...redisEnv,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
