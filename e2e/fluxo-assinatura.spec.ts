import bcrypt from 'bcryptjs';
import { expect, test } from '@playwright/test';
import { courses } from '../data/courses';
import { authenticateAs, E2E_CATALOG_COURSE, E2E_QR_CODE } from './fixtures/database';
import {
  disconnectE2EPrisma,
  E2E_PASSWORD,
  e2ePrisma,
  isolateClientIp,
  uniqueEmail,
} from './fixtures/fluxos';
import {
  checkoutCompleted,
  invoicePaid,
  invoicePaymentFailed,
  postWebhook,
  stripeId,
  subscriptionDeleted,
} from './fixtures/stripe';

/**
 * Checklist P2 (FUTURE_TASKS.md), item de pagamento. Os eventos da Stripe são
 * assinados localmente com o segredo de teste do dev server; nada é cobrado e
 * o formulário hospedado da Stripe não é automatizado.
 */

const TRIAL_DIAS = 30;

/**
 * Aluno que entrou por QR code (matrícula presencial no curso da turma) e que
 * depois assina. O customer fictício evita que o webhook crie customer na
 * Stripe ao montar o link do portal.
 */
async function criarAlunoPresencial(fluxo: string, opcoes: { comCustomer?: boolean } = {}) {
  const email = uniqueEmail(fluxo);
  const user = await e2ePrisma().user.create({
    data: {
      email,
      name: `Aluno ${fluxo} E2E`,
      role: 'student',
      passwordHash: await bcrypt.hash(E2E_PASSWORD, 4),
      emailVerified: true,
      stripeCustomerId: opcoes.comCustomer === false ? null : stripeId('cus'),
    },
  });
  const trialAte = new Date(Date.now() + TRIAL_DIAS * 86_400_000);
  const presencial = await e2ePrisma().enrollment.create({
    data: {
      userId: user.id,
      courseId: E2E_CATALOG_COURSE.id,
      turma: E2E_QR_CODE.turma,
      qrCodeId: E2E_QR_CODE.id,
      expiresAt: trialAte,
    },
  });
  return { user, presencial, trialAte, customerId: user.stripeCustomerId ?? stripeId('cus') };
}

async function matriculas(userId: string) {
  return e2ePrisma().enrollment.findMany({ where: { userId }, orderBy: { courseId: 'asc' } });
}

async function assinatura(stripeSubscriptionId: string) {
  return e2ePrisma().subscription.findUniqueOrThrow({ where: { stripeSubscriptionId } });
}

test.describe('assinatura Stripe: webhook', () => {
  test.afterAll(async () => {
    await disconnectE2EPrisma();
  });

  test('assinatura inválida é recusada sem efeito no banco', async ({ request }) => {
    const { user, customerId } = await criarAlunoPresencial('assinatura-invalida');
    const subscriptionId = stripeId('sub');

    const response = await postWebhook(
      request,
      checkoutCompleted({ userId: user.id, plan: 'premium', subscriptionId, customerId }),
      { secret: 'whsec_segredo_errado' },
    );

    expect(response.status()).toBe(400);
    expect(await e2ePrisma().subscription.count({ where: { userId: user.id } })).toBe(0);
  });

  test('ciclo premium: checkout, reenvio, renovação, falha e cancelamento', async ({ request }) => {
    const { user, presencial, customerId } = await criarAlunoPresencial('ciclo-premium');
    const subscriptionId = stripeId('sub');
    const idsCatalogo = courses.map((c) => c.id).sort();

    const checkout = checkoutCompleted({ userId: user.id, plan: 'premium', subscriptionId, customerId });

    await test.step('checkout.session.completed cria Subscription e matrículas', async () => {
      const response = await postWebhook(request, checkout);
      expect(response.status()).toBe(200);

      const sub = await assinatura(subscriptionId);
      expect(sub).toMatchObject({ userId: user.id, plan: 'premium', status: 'active', paymentMethod: 'card' });

      const lista = await matriculas(user.id);
      expect(lista.map((m) => m.courseId).sort()).toEqual(idsCatalogo);
      const daTurma = lista.find((m) => m.courseId === E2E_CATALOG_COURSE.id)!;
      expect(daTurma.id).toBe(presencial.id);
      expect(daTurma.qrCodeId).toBe(E2E_QR_CODE.id);
    });

    await test.step('reenvio do mesmo event.id não duplica nada', async () => {
      const response = await postWebhook(request, checkout);
      expect(response.status()).toBe(200);
      expect(await e2ePrisma().subscription.count({ where: { userId: user.id } })).toBe(1);
      expect(await e2ePrisma().processedWebhookEvent.count({ where: { stripeEventId: checkout.id } })).toBe(1);
      expect(await matriculas(user.id)).toHaveLength(idsCatalogo.length);
    });

    await test.step('invoice.paid renova o período', async () => {
      const vencido = new Date(Date.now() - 86_400_000);
      await e2ePrisma().subscription.update({
        where: { stripeSubscriptionId: subscriptionId },
        data: { currentPeriodEnd: vencido },
      });

      const response = await postWebhook(request, invoicePaid(subscriptionId));
      expect(response.status()).toBe(200);

      const sub = await assinatura(subscriptionId);
      expect(sub.status).toBe('active');
      expect(sub.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now() + 27 * 86_400_000);
    });

    await test.step('invoice.payment_failed marca past_due e mantém as matrículas', async () => {
      // O handler tenta abrir o portal de cobrança na Stripe; sem chave válida
      // a chamada falha e ele usa a URL de fallback.
      const response = await postWebhook(request, invoicePaymentFailed(subscriptionId));
      expect(response.status()).toBe(200);
      expect((await assinatura(subscriptionId)).status).toBe('past_due');
      expect(await matriculas(user.id)).toHaveLength(idsCatalogo.length);
    });

    await test.step('customer.subscription.deleted remove só as matrículas sem qrCodeId', async () => {
      const response = await postWebhook(request, subscriptionDeleted(subscriptionId));
      expect(response.status()).toBe(200);
      expect((await assinatura(subscriptionId)).status).toBe('canceled');

      const restantes = await matriculas(user.id);
      expect(restantes).toHaveLength(1);
      expect(restantes[0]).toMatchObject({
        id: presencial.id,
        courseId: E2E_CATALOG_COURSE.id,
        qrCodeId: E2E_QR_CODE.id,
      });
    });
  });

  test('básico: matrícula só no curso escolhido, removida no cancelamento', async ({ request }) => {
    const { user, customerId } = await criarAlunoPresencial('ciclo-basico');
    const subscriptionId = stripeId('sub');
    const cursoAssinado = courses.find((c) => c.id !== E2E_CATALOG_COURSE.id)!.id;

    const criado = await postWebhook(
      request,
      checkoutCompleted({ userId: user.id, plan: 'basico', subscriptionId, customerId, courseId: cursoAssinado }),
    );
    expect(criado.status()).toBe(200);
    expect((await matriculas(user.id)).map((m) => m.courseId).sort()).toEqual(
      [E2E_CATALOG_COURSE.id, cursoAssinado].sort(),
    );

    const cancelado = await postWebhook(request, subscriptionDeleted(subscriptionId));
    expect(cancelado.status()).toBe(200);
    expect((await matriculas(user.id)).map((m) => m.courseId)).toEqual([E2E_CATALOG_COURSE.id]);
  });

  // Bug encontrado por este spec (ver o PR): ao assinar, createEnrollmentsForSubscription
  // zera o expiresAt da matrícula presencial; no cancelamento ela é preservada por ter
  // qrCodeId, mas fica sem prazo, e o trial de 1 mês vira acesso por tempo indeterminado.
  // test.fail mantém a CI verde e passa a acusar quando o comportamento for corrigido.
  test('cancelamento devolve a matrícula presencial ao prazo do trial', async ({ request }) => {
    test.fail(true, 'Bug conhecido: o trial por QR code perde o prazo depois de assinar e cancelar.');
    const { user, presencial, customerId } = await criarAlunoPresencial('trial-apos-cancelamento');
    const subscriptionId = stripeId('sub');

    await postWebhook(request, checkoutCompleted({ userId: user.id, plan: 'premium', subscriptionId, customerId }));
    await postWebhook(request, subscriptionDeleted(subscriptionId));

    const daTurma = await e2ePrisma().enrollment.findUniqueOrThrow({ where: { id: presencial.id } });
    expect(daTurma.expiresAt).not.toBeNull();
  });

  // Bug encontrado por este spec (ver o PR): matrícula de assinante tem expiresAt nulo
  // e isLifetime falso; o servidor a trata como ativa (checkAccessStatus), mas
  // useEnrolledCourses a descarta, e o assinante não vê os cursos no painel.
  test('assinante vê os cursos do plano na área restrita', async ({ page, request }) => {
    test.fail(true, 'Bug conhecido: useEnrolledCourses oculta matrículas de assinatura (expiresAt nulo).');
    const { user, customerId } = await criarAlunoPresencial('painel-assinante');
    const subscriptionId = stripeId('sub');
    const cursoSoDoPlano = courses.find((c) => c.id !== E2E_CATALOG_COURSE.id)!;

    await postWebhook(request, checkoutCompleted({ userId: user.id, plan: 'premium', subscriptionId, customerId }));

    await isolateClientIp(page.context());
    await authenticateAs(page.context(), {
      userId: user.id,
      role: 'student',
      email: user.email,
      name: user.name,
    });
    await page.goto('/area-restrita');
    await expect(page.getByRole('heading', { name: /Bem-vindo, Aluno/ }).first()).toBeVisible();
    await expect(page.getByText(cursoSoDoPlano.title).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('assinatura Stripe: checkout', () => {
  test.afterAll(async () => {
    await disconnectE2EPrisma();
  });

  test('entrada inválida é recusada antes de chamar a Stripe', async ({ page }) => {
    const { user } = await criarAlunoPresencial('checkout-validacao');
    await isolateClientIp(page.context());
    await authenticateAs(page.context(), { userId: user.id, role: 'student', email: user.email, name: user.name });
    const api = page.context().request;

    const semCurso = await api.post('/api/pagamento/checkout', { data: { plan: 'basico', method: 'card' } });
    expect(semCurso.status()).toBe(400);
    expect((await semCurso.json()).error).toContain('courseId obrigatório');

    const planoInexistente = await api.post('/api/pagamento/checkout', { data: { plan: 'ouro', method: 'card' } });
    expect(planoInexistente.status()).toBe(400);

    const pix = await api.post('/api/pagamento/checkout', { data: { plan: 'premium', method: 'pix' } });
    expect(pix.status()).toBe(400);
    expect((await pix.json()).error).toContain('PIX');

    await e2ePrisma().subscription.create({
      data: {
        userId: user.id,
        plan: 'premium',
        billingCycle: 'monthly',
        status: 'active',
        stripeSubscriptionId: stripeId('sub'),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    const jaAssinante = await api.post('/api/pagamento/checkout', { data: { plan: 'premium', method: 'card' } });
    expect(jaAssinante.status()).toBe(409);
  });

  test('cria a sessão de checkout e devolve a URL da Stripe', async ({ page }) => {
    test.skip(
      !process.env.STRIPE_TEST_SECRET_KEY,
      'Sem STRIPE_TEST_SECRET_KEY (sk_test_) nos secrets da CI; a criação da sessão exige a API da Stripe em modo teste.',
    );
    // Sem customer prévio: a rota cria um customer no modo teste da Stripe.
    const { user } = await criarAlunoPresencial('checkout-sessao', { comCustomer: false });
    await isolateClientIp(page.context());
    await authenticateAs(page.context(), { userId: user.id, role: 'student', email: user.email, name: user.name });

    const response = await page.context().request.post('/api/pagamento/checkout', {
      data: { plan: 'premium', billingCycle: 'monthly', method: 'card' },
    });
    expect(response.status()).toBe(200);
    const { url } = await response.json();
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  });
});
