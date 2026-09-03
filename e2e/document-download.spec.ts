import { expect, test } from '@playwright/test';
import { authenticateAs, E2E_IDS, E2E_USERS } from './fixtures/database';

test.describe('download de documentos restritos', () => {
  test('visitante recebe 401 em documento comum restrito', async ({ page }) => {
    const response = await page.context().request.get(
      `/api/documents/${E2E_IDS.commonDocument}/download`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(401);
  });

  test('aluno com qualquer acesso ativo baixa documento comum', async ({ page }) => {
    await authenticateAs(page.context(), E2E_USERS.active);

    const response = await page.context().request.get(
      `/api/documents/${E2E_IDS.commonDocument}/download`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe('https://example.com/e2e-common.pdf');
  });

  test('aluno sem acesso ativo recebe 403 em documento comum', async ({ page }) => {
    await authenticateAs(page.context(), E2E_USERS.expired);

    const response = await page.context().request.get(
      `/api/documents/${E2E_IDS.commonDocument}/download`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(403);
  });
});
