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
});
