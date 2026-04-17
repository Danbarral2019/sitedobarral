// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test', role: 'user' };

const { mockSubscriptionFindFirst, mockCreateCheckoutSession } = vi.hoisted(() => ({
  mockSubscriptionFindFirst: vi.fn(),
  mockCreateCheckoutSession: vi.fn(),
}));

vi.mock('@/lib/api-middleware', () => ({
  withAuth: (h: any) => async (req: Request) => h(req, { user: mockUser }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findFirst: mockSubscriptionFindFirst,
    },
  },
}));

vi.mock('@/lib/stripe', () => ({
  createCheckoutSession: (...args: any[]) => mockCreateCheckoutSession(...args),
}));

vi.mock('@/lib/monitoring/events', () => ({
  trackServerEvent: vi.fn(),
}));

vi.mock('@/lib/errors/error-handler', () => ({
  handleApiError: (err: any) => {
    const status = err?.statusCode || 500;
    return new Response(JSON.stringify({ error: err?.message }), { status });
  },
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from '@/app/api/pagamento/checkout/route';

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/pagamento/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/pagamento/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionFindFirst.mockResolvedValue(null);
    mockCreateCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.com/session_123', sessionId: 'session_123' });
  });

  it('returns 400 for invalid schema (e.g. plan=foo)', async () => {
    const res = await POST(makeRequest({ plan: 'foo', method: 'card' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for basico without courseId', async () => {
    const res = await POST(makeRequest({ plan: 'basico', method: 'card' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('courseId');
  });

  it('returns 409 when user has active subscription', async () => {
    mockSubscriptionFindFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 86400000),
    });

    const res = await POST(makeRequest({ plan: 'premium', method: 'card' }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain('assinatura ativa');
  });

  it('returns 200 + url for valid checkout (card + basico + courseId)', async () => {
    const res = await POST(makeRequest({ plan: 'basico', method: 'card', courseId: 'course-1' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBe('https://checkout.stripe.com/session_123');
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        plan: 'basico',
        method: 'card',
        courseId: 'course-1',
      }),
    );
  });
});
