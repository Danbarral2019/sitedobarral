import { defineConfig, devices } from '@playwright/test';
import {
  E2E_BASE_URL,
  E2E_JWT_SECRET,
  resolveE2EDatabaseUrl,
} from './e2e/fixtures/database';

const databaseUrl = resolveE2EDatabaseUrl();

export default defineConfig({
  testDir: './e2e',
  globalSetup: './scripts/e2e-seed.ts',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
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
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
