import { expect, test, type Locator, type Page } from '@playwright/test';

// O dev server compila /cursos e /glossario no primeiro acesso; 30 s (padrão)
// não bastam na CI.
test.describe.configure({ timeout: 120_000 });

// A barra completa, com 13 itens, ocupava cerca de 1490 px: transbordava em
// todas as larguras abaixo de 1536 px e empurrava "Área do Aluno" para fora da
// tela (e, fora do fundo do cabeçalho, para contraste de 1,01:1).
const LARGURAS_DESKTOP = [1024, 1280, 1366, 1440, 1536, 1920] as const;
const LARGURAS_MENU_MOVEL = [390, 1023] as const;

async function expectSemRolagemHorizontal(page: Page) {
  const { rolagem, visivel } = await page.evaluate(() => ({
    rolagem: document.documentElement.scrollWidth,
    // No Chromium headless a barra de rolagem fica oculta e clientWidth é igual
    // a innerWidth; com barra clássica, clientWidth já a desconta.
    visivel: document.documentElement.clientWidth,
  }));
  expect(rolagem, 'a página não deve rolar na horizontal').toBe(visivel);
}

// Um clique anterior à hidratação não abre o painel; repete até o React responder.
async function abrir(botao: Locator) {
  await expect(async () => {
    await botao.click();
    await expect(botao).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 });
  }).toPass();
}

test.describe('cabeçalho', () => {
  for (const largura of LARGURAS_DESKTOP) {
    test(`cabe em ${largura} px, com "Área do Aluno" inteiro na tela`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto('/cursos');
      const cabecalho = page.getByRole('banner');

      await expect(cabecalho.getByRole('link', { name: 'Área do Aluno' })).toBeInViewport({ ratio: 1 });
      await expect(cabecalho.locator('button[aria-controls="cabecalho-menu-movel"]')).toBeHidden();
      await expectSemRolagemHorizontal(page);

      // Os painéis abertos também não podem empurrar a página para o lado.
      for (const nome of ['Cursos', 'Mais']) {
        const botao = cabecalho.getByRole('button', { name: nome, exact: true });
        await abrir(botao);
        await expect(page.locator(`#${await botao.getAttribute('aria-controls')}`)).toBeInViewport({ ratio: 1 });
        await expectSemRolagemHorizontal(page);

        await page.keyboard.press('Escape');
        await expect(botao).toHaveAttribute('aria-expanded', 'false');
      }
    });
  }

  for (const largura of LARGURAS_MENU_MOVEL) {
    test(`em ${largura} px, o menu móvel abre, navega e fecha`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 844 });
      await page.goto('/cursos');
      const cabecalho = page.getByRole('banner');

      await expect(cabecalho.getByRole('link', { name: 'Área do Aluno' })).toBeInViewport({ ratio: 1 });
      await expect(cabecalho.getByRole('button', { name: 'Mais', exact: true })).toBeHidden();
      await expectSemRolagemHorizontal(page);

      await abrir(cabecalho.locator('button[aria-controls="cabecalho-menu-movel"]'));
      const menu = page.locator('#cabecalho-menu-movel');
      await expect(menu.getByRole('link')).toHaveCount(12);

      await menu.getByRole('link', { name: 'Glossário' }).click();
      await expect(page).toHaveURL(/\/glossario$/, { timeout: 60_000 });
      await expect(menu).toHaveCount(0);
    });
  }
});
