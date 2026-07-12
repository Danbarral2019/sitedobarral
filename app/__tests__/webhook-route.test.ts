// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// ── Hoisted mocks (accessible inside vi.mock factories) ───────────────────

const {
  mockConstructEvent,
  mockInvoicesRetrieve,
  mockChargesRetrieve,
  mockCreateEnrollments,
  mockRemoveEnrollments,
  mockCalculatePeriodEnd,
  mockProcessedCreate,
  mockProcessedDelete,
  mockSubscriptionCreate,
  mockSubscriptionFindUnique,
  mockSubscriptionUpdate,
  mockSubscriptionUpdateMany,
  mockUserFindUnique,
  mockCreateBillingPortal,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockInvoicesRetrieve: vi.fn(),
  mockChargesRetrieve: vi.fn(),
  mockCreateEnrollments: vi.fn(),
  mockRemoveEnrollments: vi.fn(),
  mockCalculatePeriodEnd: vi.fn(),
  mockProcessedCreate: vi.fn(),
  mockProcessedDelete: vi.fn(),
  mockSubscriptionCreate: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockSubscriptionUpdate: vi.fn(),
  mockSubscriptionUpdateMany: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockCreateBillingPortal: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mockConstructEvent },
    invoices: { retrieve: mockInvoicesRetrieve },
    charges: { retrieve: mockChargesRetrieve },
  }),
  createEnrollmentsForSubscription: (...args: any[]) => mockCreateEnrollments(...args),
  removeEnrollmentsForSubscription: (...args: any[]) => mockRemoveEnrollments(...args),
  calculatePeriodEnd: (...args: any[]) => mockCalculatePeriodEnd(...args),
  createBillingPortalSession: (...args: any[]) => mockCreateBillingPortal(...args),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    processedWebhookEvent: {
      create: (...args: any[]) => mockProcessedCreate(...args),
      delete: (...args: any[]) => mockProcessedDelete(...args),
    },
    subscription: {
      create: (...args: any[]) => mockSubscriptionCreate(...args),
      findUnique: (...args: any[]) => mockSubscriptionFindUnique(...args),
      update: (...args: any[]) => mockSubscriptionUpdate(...args),
      updateMany: (...args: any[]) => mockSubscriptionUpdateMany(...args),
    },
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/monitoring/events', () => ({
  trackServerEvent: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/email-templates/subscription', () => ({
  renderWelcomeEmail: vi.fn().mockReturnValue({ subject: '', html: '' }),
  renderReceiptEmail: vi.fn().mockReturnValue({ subject: '', html: '' }),
  renderCardFailedEmail: vi.fn().mockReturnValue({ subject: '', html: '' }),
  renderPixMandateFailedEmail: vi.fn().mockReturnValue({ subject: '', html: '' }),
  renderCanceledEmail: vi.fn().mockReturnValue({ subject: '', html: '' }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

import { POST } from '@/app/api/pagamento/webhook/route';

// ── Helpers ───────────────────────────────────────────────────────────────

const ORIGINAL_ENV = process.env;

function makeRequest(body: string, sig?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sig) headers['stripe-signature'] = sig;
  return new Request('http://localhost/api/pagamento/webhook', {
    method: 'POST',
    headers,
    body,
  });
}

function makeEvent(type: string, data: Record<string, unknown> = {}): any {
  return {
    id: 'evt_test_123',
    type,
    data: { object: data },
  };
}

describe('POST /api/pagamento/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, STRIPE_WEBHOOK_SECRET: 'whsec_test' };
    mockProcessedCreate.mockResolvedValue({});
    mockProcessedDelete.mockResolvedValue({});
    mockCalculatePeriodEnd.mockReturnValue(new Date('2026-05-16'));
    mockCreateBillingPortal.mockResolvedValue({ url: 'https://portal.stripe/session' });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  // 1. Fail-closed
  it('returns 500 if STRIPE_WEBHOOK_SECRET is missing', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(makeRequest('{}') as any);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('misconfigured');
  });

  // 2. No signature header
  it('returns 400 without stripe-signature header', async () => {
    const res = await POST(makeRequest('{}') as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('stripe-signature');
  });

  // 3. Invalid signature
  it('returns 400 with invalid signature', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    const res = await POST(makeRequest('{}', 'bad_sig') as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid signature');
  });

  // 4. Dedup collision
  it('returns 200 on dedup collision (already processed)', async () => {
    mockConstructEvent.mockReturnValue(makeEvent('checkout.session.completed'));
    mockProcessedCreate.mockRejectedValue({ code: 'P2002' });

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    // Handler should NOT be called
    expect(mockSubscriptionCreate).not.toHaveBeenCalled();
  });

  // 5. checkout.session.completed
  it('creates Subscription + enrollments on checkout.session.completed', async () => {
    const sessionEvent = makeEvent('checkout.session.completed', {
      id: 'cs_test_123',
      subscription: 'sub_stripe_1',
      customer: 'cus_1',
      payment_method_types: ['card'],
      metadata: {
        userId: 'user-1',
        plan: 'basico',
        billingCycle: 'monthly',
        courseId: 'course-1',
      },
    });

    mockConstructEvent.mockReturnValue(sessionEvent);
    mockSubscriptionCreate.mockResolvedValue({});
    mockCreateEnrollments.mockResolvedValue(undefined);
    mockUserFindUnique.mockResolvedValue({ email: 'user@test.com', name: 'User' });

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);

    expect(mockSubscriptionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        plan: 'basico',
        stripeSubscriptionId: 'sub_stripe_1',
        status: 'active',
      }),
    });

    expect(mockCreateEnrollments).toHaveBeenCalledWith({
      userId: 'user-1',
      plan: 'basico',
      courseId: 'course-1',
    });
  });

  // 5b. subscription.updated com cancel_at (Customer Portal moderno)
  // Regression: handler antes só lia `cancel_at_period_end` (boolean) — Stripe
  // Portal agenda via `cancel_at` (timestamp). Sem esse fix, cancelamento via
  // portal era silenciosamente ignorado no DB.
  it('marks cancelAtPeriodEnd=true when subscription.updated carries cancel_at timestamp', async () => {
    const updateEvent = makeEvent('customer.subscription.updated', {
      id: 'sub_stripe_1',
      status: 'active',
      cancel_at_period_end: false,
      cancel_at: 1779999999, // qualquer timestamp futuro
      items: { data: [{ current_period_end: 1779999999 }] },
    });

    mockConstructEvent.mockReturnValue(updateEvent);
    mockSubscriptionFindUnique.mockResolvedValue({ status: 'active' });
    mockSubscriptionUpdate.mockResolvedValue({});

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_stripe_1' },
      data: expect.objectContaining({ cancelAtPeriodEnd: true }),
    });
  });

  // 6. customer.subscription.deleted
  it('cancels subscription and removes enrollments on subscription.deleted', async () => {
    const deletedEvent = makeEvent('customer.subscription.deleted', {
      id: 'sub_stripe_1',
    });

    mockConstructEvent.mockReturnValue(deletedEvent);
    mockSubscriptionUpdateMany.mockResolvedValue({ count: 1 });
    mockRemoveEnrollments.mockResolvedValue(undefined);
    mockSubscriptionFindUnique.mockResolvedValue({
      user: { email: 'user@test.com', name: 'User' },
    });

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);

    expect(mockSubscriptionUpdateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_stripe_1' },
      data: { status: 'canceled' },
    });

    expect(mockRemoveEnrollments).toHaveBeenCalledWith('sub_stripe_1');
  });

  // 7a. invoice.payment_succeeded reaches the same handler as invoice.paid
  // Regression: cadastrado no Stripe Dashboard mas faltava no HANDLERS dispatch table.
  it('renews period on invoice.payment_succeeded (alias of invoice.paid)', async () => {
    const invoiceEvent = makeEvent('invoice.payment_succeeded', {
      id: 'in_test_1',
      amount_paid: 4990,
      currency: 'brl',
      hosted_invoice_url: 'https://invoice.url',
      parent: { subscription_details: { subscription: 'sub_stripe_1' } },
    });

    mockConstructEvent.mockReturnValue(invoiceEvent);
    mockSubscriptionFindUnique.mockResolvedValue({
      stripeSubscriptionId: 'sub_stripe_1',
      plan: 'basico',
      billingCycle: 'monthly',
      paymentMethod: 'card',
      user: { email: 'user@test.com', name: 'User' },
    });
    mockSubscriptionUpdate.mockResolvedValue({});

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_stripe_1' },
      data: expect.objectContaining({ status: 'active' }),
    });
  });

  // 7. Handler failure -> dedup rollback + 500
  it('rolls back dedup record and returns 500 on handler failure', async () => {
    const sessionEvent = makeEvent('checkout.session.completed', {
      id: 'cs_test_123',
      subscription: 'sub_stripe_1',
      customer: 'cus_1',
      payment_method_types: ['card'],
      metadata: {
        userId: 'user-1',
        plan: 'basico',
        billingCycle: 'monthly',
        courseId: 'course-1',
      },
    });

    mockConstructEvent.mockReturnValue(sessionEvent);
    mockSubscriptionCreate.mockRejectedValue(new Error('DB error'));

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(500);

    // Dedup record should be rolled back
    expect(mockProcessedDelete).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_test_123' },
    });
  });

  // 8. invoice.payment_failed → marca past_due + envia email de falha
  it('marks subscription past_due and emails on invoice.payment_failed', async () => {
    const failedEvent = makeEvent('invoice.payment_failed', {
      id: 'in_fail_1',
      parent: { subscription_details: { subscription: 'sub_stripe_1' } },
    });
    mockConstructEvent.mockReturnValue(failedEvent);
    mockSubscriptionFindUnique.mockResolvedValue({
      userId: 'user-1',
      paymentMethod: 'card',
      user: { email: 'user@test.com', name: 'User' },
    });
    mockSubscriptionUpdate.mockResolvedValue({});

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_stripe_1' },
      data: { status: 'past_due' },
    });
    // Deve resolver a URL do portal de cobrança para o email
    expect(mockCreateBillingPortal).toHaveBeenCalledWith('user-1', expect.stringContaining('/area-restrita'));
  });

  it('no-ops on invoice.payment_failed when subscription is unknown', async () => {
    const failedEvent = makeEvent('invoice.payment_failed', {
      id: 'in_fail_2',
      parent: { subscription_details: { subscription: 'sub_unknown' } },
    });
    mockConstructEvent.mockReturnValue(failedEvent);
    mockSubscriptionFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
  });

  // 9. charge.refunded → cancela e remove enrollments
  it('cancels subscription and removes enrollments on charge.refunded', async () => {
    const refundEvent = makeEvent('charge.refunded', {
      id: 'ch_1',
      invoice: 'in_1',
    });
    mockConstructEvent.mockReturnValue(refundEvent);
    mockInvoicesRetrieve.mockResolvedValue({
      parent: { subscription_details: { subscription: 'sub_stripe_1' } },
    });
    mockSubscriptionUpdateMany.mockResolvedValue({ count: 1 });
    mockRemoveEnrollments.mockResolvedValue(undefined);

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    expect(mockSubscriptionUpdateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_stripe_1' },
      data: { status: 'canceled' },
    });
    expect(mockRemoveEnrollments).toHaveBeenCalledWith('sub_stripe_1');
  });

  it('no-ops on charge.refunded when charge has no invoice', async () => {
    const refundEvent = makeEvent('charge.refunded', { id: 'ch_2' }); // sem invoice
    mockConstructEvent.mockReturnValue(refundEvent);

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    expect(mockInvoicesRetrieve).not.toHaveBeenCalled();
    expect(mockSubscriptionUpdateMany).not.toHaveBeenCalled();
  });

  // 10. charge.dispute.created → cancela, remove e alerta no Sentry
  it('cancels subscription and removes enrollments on charge.dispute.created', async () => {
    const disputeEvent = makeEvent('charge.dispute.created', {
      id: 'dp_1',
      charge: 'ch_1', // string → força charges.retrieve
    });
    mockConstructEvent.mockReturnValue(disputeEvent);
    mockChargesRetrieve.mockResolvedValue({ id: 'ch_1', invoice: 'in_1' });
    mockInvoicesRetrieve.mockResolvedValue({
      parent: { subscription_details: { subscription: 'sub_stripe_1' } },
    });
    mockSubscriptionUpdateMany.mockResolvedValue({ count: 1 });
    mockRemoveEnrollments.mockResolvedValue(undefined);

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    expect(mockChargesRetrieve).toHaveBeenCalledWith('ch_1');
    expect(mockSubscriptionUpdateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_stripe_1' },
      data: { status: 'canceled' },
    });
    expect(mockRemoveEnrollments).toHaveBeenCalledWith('sub_stripe_1');
  });

  it('no-ops on charge.dispute.created when dispute has no charge', async () => {
    const disputeEvent = makeEvent('charge.dispute.created', { id: 'dp_2', charge: null });
    mockConstructEvent.mockReturnValue(disputeEvent);

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    expect(mockChargesRetrieve).not.toHaveBeenCalled();
  });

  // 11. subscription.updated com subscription desconhecida → warn + no-op
  it('no-ops on subscription.updated when subscription is unknown', async () => {
    const updateEvent = makeEvent('customer.subscription.updated', {
      id: 'sub_unknown',
      status: 'active',
      items: { data: [{ current_period_end: 1779999999 }] },
    });
    mockConstructEvent.mockReturnValue(updateEvent);
    mockSubscriptionFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
  });

  it('no-ops on invoice.payment_failed when invoice has no subscription', async () => {
    const failedEvent = makeEvent('invoice.payment_failed', { id: 'in_fail_3' }); // sem parent
    mockConstructEvent.mockReturnValue(failedEvent);

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    expect(mockSubscriptionFindUnique).not.toHaveBeenCalled();
  });

  it('no-ops on charge.refunded when the invoice has no subscription', async () => {
    const refundEvent = makeEvent('charge.refunded', { id: 'ch_3', invoice: 'in_x' });
    mockConstructEvent.mockReturnValue(refundEvent);
    mockInvoicesRetrieve.mockResolvedValue({}); // invoice sem subscription_details

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    expect(mockSubscriptionUpdateMany).not.toHaveBeenCalled();
  });

  it('no-ops on charge.dispute.created when the charge has no invoice', async () => {
    const disputeEvent = makeEvent('charge.dispute.created', { id: 'dp_3', charge: 'ch_x' });
    mockConstructEvent.mockReturnValue(disputeEvent);
    mockChargesRetrieve.mockResolvedValue({ id: 'ch_x' }); // charge sem invoice

    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    expect(mockSubscriptionUpdateMany).not.toHaveBeenCalled();
  });

  // 12. Eventos ignorados → 200 silencioso, sem despachar handler
  it('returns 200 and ignores events in IGNORED_EVENTS', async () => {
    mockConstructEvent.mockReturnValue(makeEvent('customer.created', { id: 'cus_1' }));
    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
    expect(mockSubscriptionCreate).not.toHaveBeenCalled();
  });

  // 13. Evento desconhecido (não ignorado, sem handler) → 200
  it('returns 200 for unknown event types without a handler', async () => {
    mockConstructEvent.mockReturnValue(makeEvent('some.unhandled.event', {}));
    const res = await POST(makeRequest('{}', 'valid_sig') as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
  });
});
