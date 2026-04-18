// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockSubscriptionFindFirst,
  mockCreateBillingPortalSession,
} = vi.hoisted(() => ({
  mockSubscriptionFindFirst: vi.fn(),
  mockCreateBillingPortalSession: vi.fn(),
}));

// Pass-through withAuth with an injected user — we don't test auth here.
vi.mock('@/lib/api-middleware', () => ({
  withAuth: (handler: any) => (req: any, ctx?: any) =>
    handler(req, { ...ctx, user: { userId: 'user-1', email: 'u@x.com', role: 'student' } }),
}));

vi.mock('@/lib/stripe', () => ({
  createBillingPortalSession: (...args: any[]) => mockCreateBillingPortalSession(...args),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findFirst: (...args: any[]) => mockSubscriptionFindFirst(...args),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/errors/error-handler', () => ({
  handleApiError: (err: unknown) => new Response(String(err), { status: 500 }),
}));

import { GET } from '@/app/api/conta/portal/route';

function makeRequest(): Request {
  return new Request('https://profdanielbarral.com/api/conta/portal', { method: 'GET' });
}

describe('GET /api/conta/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_BASE_URL = 'https://profdanielbarral.com';
  });

  it('redireciona para /planos quando usuário não tem subscription', async () => {
    mockSubscriptionFindFirst.mockResolvedValue(null);

    const res = await GET(makeRequest() as any);

    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://profdanielbarral.com/planos');
    expect(mockCreateBillingPortalSession).not.toHaveBeenCalled();
  });

  it('redireciona para o portal do Stripe quando tem subscription', async () => {
    mockSubscriptionFindFirst.mockResolvedValue({ id: 'sub-123' });
    mockCreateBillingPortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/session/abc',
    });

    const res = await GET(makeRequest() as any);

    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://billing.stripe.com/session/abc');
    expect(mockCreateBillingPortalSession).toHaveBeenCalledWith(
      'user-1',
      'https://profdanielbarral.com/area-restrita',
    );
  });

  it('busca a subscription pelo userId do contexto autenticado', async () => {
    mockSubscriptionFindFirst.mockResolvedValue(null);

    await GET(makeRequest() as any);

    expect(mockSubscriptionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
      }),
    );
  });

  it('propaga falhas do Stripe pelo handleApiError', async () => {
    mockSubscriptionFindFirst.mockResolvedValue({ id: 'sub-123' });
    mockCreateBillingPortalSession.mockRejectedValue(new Error('Stripe down'));

    const res = await GET(makeRequest() as any);

    expect(res.status).toBe(500);
  });
});
