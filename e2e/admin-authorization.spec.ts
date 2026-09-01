import { expect, test } from '@playwright/test';
import { authenticateAs, E2E_USERS } from './fixtures/database';

test.describe('autorização administrativa', () => {
  test('visitante recebe 401 sem depender do banco ou do Redis', async ({ page }) => {
    const response = await page.context().request.get('/api/admin/depoimentos');

    expect(response.status()).toBe(401);
  });

  test('aluno autenticado recebe 403', async ({ page }) => {
    await authenticateAs(page.context(), E2E_USERS.active);

    const response = await page.context().request.get('/api/admin/depoimentos');

    expect(response.status()).toBe(403);
  });
});
