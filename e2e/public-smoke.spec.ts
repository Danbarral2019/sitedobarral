import { expect, test } from '@playwright/test';

const PUBLIC_PAGES = [
  '/',
  '/base-conhecimento',
  '/jurisprudencia',
  '/glossario',
  '/login',
] as const;

const VIEWPORTS = [
  { label: 'desktop', size: null },
  { label: 'mobile 390 px', size: { width: 390, height: 844 } },
] as const;

test.describe('smoke público', () => {
  for (const viewport of VIEWPORTS) {
    for (const path of PUBLIC_PAGES) {
      test(`${path} renderiza sem erro em ${viewport.label}`, async ({ page }) => {
        if (viewport.size) await page.setViewportSize(viewport.size);

        const browserErrors: string[] = [];
        page.on('console', (message) => {
          if (message.type() === 'error') browserErrors.push(message.text());
        });
        page.on('pageerror', (error) => browserErrors.push(error.message));

        const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

        expect(response, `sem resposta HTTP para ${path}`).not.toBeNull();
        expect(response!.status(), `status inesperado em ${path}`).toBeLessThan(400);
        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.locator('[data-nextjs-dialog-overlay]')).toHaveCount(0);
        expect(browserErrors, `erros de navegador em ${path}`).toEqual([]);
      });
    }
  }
});
