import { expect, test } from '@playwright/test';
import { E2E_CATALOG_COURSE, E2E_QR_CODE } from './fixtures/database';
import {
  disconnectE2EPrisma,
  e2ePrisma,
  isolateClientIp,
  loginViaUi,
  readVerificationToken,
  registerViaUi,
  requireRateLimitBackend,
  uniqueEmail,
} from './fixtures/fluxos';

/**
 * Checklist P2 (FUTURE_TASKS.md), itens de registro. O token de verificação é
 * lido do banco descartável; nenhum email sai do dev server (sem
 * RESEND_API_KEY, lib/email só registra no console).
 */
test.describe('fluxos de registro e verificação de email', () => {
  test.beforeEach(async ({ context }) => {
    requireRateLimitBackend();
    await isolateClientIp(context);
  });

  test.afterAll(async () => {
    await disconnectE2EPrisma();
  });

  test('registro sem QR code: verificação, login e página de planos', async ({ page, context }) => {
    const email = uniqueEmail('sem-qr');
    await registerViaUi(page, { name: 'Aluno Sem QR E2E', email });

    const criado = await e2ePrisma().user.findUniqueOrThrow({
      where: { email },
      include: { enrollments: true },
    });
    expect(criado.emailVerified).toBe(false);
    expect(criado.enrollments).toHaveLength(0);

    // Antes da verificação o login é recusado com a orientação específica.
    await loginViaUi(page, email);
    await expect(page.getByText('Email não verificado', { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    // Link do email: /verificar-email?token=...
    const token = await readVerificationToken(email);
    await page.goto(`/verificar-email?token=${token}`);
    // Em desenvolvimento o React (StrictMode) executa o efeito da página duas
    // vezes e a segunda chamada encontra o token já consumido; por isso a
    // verificação é conferida no banco, e não no texto da página.
    await expect
      .poll(async () => (await e2ePrisma().user.findUniqueOrThrow({ where: { email } })).emailVerified)
      .toBe(true);
    const verificado = await e2ePrisma().user.findUniqueOrThrow({ where: { email } });
    expect(verificado.verificationToken).toBeNull();

    // Login pela UI, em sessão limpa.
    await context.clearCookies();
    await loginViaUi(page, email);
    await expect(page).toHaveURL(/\/area-restrita/);

    // Sem matrícula nem assinatura, o caminho seguinte é a página de planos.
    await page.getByRole('link', { name: 'Planos', exact: true }).first().click();
    await expect(page).toHaveURL(/\/planos/);
    await expect(page.getByRole('heading', { name: 'Planos de Assinatura' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Básico', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Premium', exact: true })).toBeVisible();
  });

  test('registro com QR code: matrícula de 1 mês visível na área restrita', async ({ page, context }) => {
    const email = uniqueEmail('com-qr');
    const antes = await e2ePrisma().qRCode.findUniqueOrThrow({ where: { code: E2E_QR_CODE.code } });

    await registerViaUi(page, { name: 'Aluno Com QR E2E', email, qrCode: E2E_QR_CODE.code });

    const criado = await e2ePrisma().user.findUniqueOrThrow({
      where: { email },
      include: { enrollments: true },
    });
    expect(criado.enrollments).toHaveLength(1);
    const [matricula] = criado.enrollments;
    expect(matricula.courseId).toBe(E2E_CATALOG_COURSE.id);
    expect(matricula.qrCodeId).toBe(E2E_QR_CODE.id);
    expect(matricula.turma).toBe(E2E_QR_CODE.turma);
    expect(matricula.isLifetime).toBe(false);

    // Trial de 1 mês contado do registro (tolerância para meses de 28 a 31 dias).
    const dias = (matricula.expiresAt!.getTime() - matricula.enrolledAt.getTime()) / 86_400_000;
    expect(dias).toBeGreaterThanOrEqual(27.9);
    expect(dias).toBeLessThanOrEqual(31.1);

    const depois = await e2ePrisma().qRCode.findUniqueOrThrow({ where: { code: E2E_QR_CODE.code } });
    expect(depois.usedCount).toBeGreaterThan(antes.usedCount);

    const token = await readVerificationToken(email);
    await page.goto(`/verificar-email?token=${token}`);
    await expect
      .poll(async () => (await e2ePrisma().user.findUniqueOrThrow({ where: { email } })).emailVerified)
      .toBe(true);

    await context.clearCookies();
    await loginViaUi(page, email);
    await expect(page).toHaveURL(/\/area-restrita/);
    await expect(page.getByText(E2E_CATALOG_COURSE.title).first()).toBeVisible();
  });

  test('reenvio da verificação: o token novo funciona e o antigo não', async ({ page }) => {
    const email = uniqueEmail('reenvio');
    await registerViaUi(page, { name: 'Aluno Reenvio E2E', email });
    const tokenAntigo = await readVerificationToken(email);

    await page.getByRole('button', { name: 'Clique aqui para reenviar' }).click();
    await expect(page.getByText('Email reenviado com sucesso', { exact: false })).toBeVisible();

    const tokenNovo = await readVerificationToken(email);
    expect(tokenNovo).not.toBe(tokenAntigo);

    // Formulário manual de /verificar-email: uma chamada por envio, sem o
    // efeito duplicado do link, o que permite conferir a mensagem na tela.
    await page.goto('/verificar-email');
    await page.getByPlaceholder('Cole o token aqui').fill(tokenAntigo);
    await page.getByRole('button', { name: 'Verificar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Erro na Verificação' })).toBeVisible();
    await expect(page.getByText('Token inválido ou expirado')).toBeVisible();
    expect((await e2ePrisma().user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(false);

    await page.goto('/verificar-email');
    await page.getByPlaceholder('Cole o token aqui').fill(tokenNovo);
    await page.getByRole('button', { name: 'Verificar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Email Verificado com Sucesso!' })).toBeVisible();
    await expect(page).toHaveURL(/\/area-restrita/, { timeout: 15_000 });
    expect((await e2ePrisma().user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(true);
  });
});
