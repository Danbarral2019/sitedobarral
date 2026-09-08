import { expect, test } from '@playwright/test';
import { authenticateAs, E2E_IDS, E2E_USERS } from './fixtures/database';

test.describe('expiração de acesso ao curso', () => {
  test('matrícula ativa permite baixar documento do curso', async ({ page }) => {
    await authenticateAs(page.context(), E2E_USERS.active);

    const response = await page.context().request.get(
      `/api/documents/${E2E_IDS.privateDocument}/download`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe('https://example.com/e2e-private.pdf');
  });

  test('matrícula expirada recebe 403 no mesmo documento', async ({ page }) => {
    await authenticateAs(page.context(), E2E_USERS.expired);

    const response = await page.context().request.get(
      `/api/documents/${E2E_IDS.privateDocument}/download`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(403);
  });
});
