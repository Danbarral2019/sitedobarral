// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockSessionsRetrieve,
  mockSubscriptionFindUnique,
} = vi.hoisted(() => ({
  mockSessionsRetrieve: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
}));

// Pass-through withUserApi with an injected ctx + handleApiError on throw.
vi.mock('@/lib/api/handler', async () => {
  const { handleApiError } = await import('@/lib/errors/error-handler');
  return {
    withUserApi: (handler: any) => async (req: any, nextCtx?: any) => {
      const ctx = {
        params: nextCtx?.params ? await nextCtx.params : {},
        user: { userId: 'user-1', email: 'u@x.com', role: 'student' },
        requestId: 'test-req-id',
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };
      try {
        return await handler(req, ctx);
      } catch (err) {
        return handleApiError(err);
      }
    },
  };
});

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    checkout: { sessions: { retrieve: mockSessionsRetrieve } },
  }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: (...args: any[]) => mockSubscriptionFindUnique(...args),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Use the real error handler so we assert real status codes.
import { GET } from '@/app/api/pagamento/status/route';

function makeRequest(sessionId?: string): Request {
  const url = sessionId
    ? `http://localhost/api/pagamento/status?session_id=${sessionId}`
    : 'http://localhost/api/pagamento/status';
  return new Request(url, { method: 'GET' });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

const routeCtx = { params: Promise.resolve({}) };

describe('GET /api/pagamento/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 400 quando session_id está ausente', async () => {
    const res = await GET(makeRequest() as any, routeCtx);
    expect(res.status).toBe(400);
  });

  it('retorna 404 quando a session não existe no Stripe', async () => {
    mockSessionsRetrieve.mockRejectedValue(new Error('No such session'));
    const res = await GET(makeRequest('cs_bogus') as any, routeCtx);
    expect(res.status).toBe(404);
    expect(mockSubscriptionFindUnique).not.toHaveBeenCalled();
  });

  it('retorna 403 quando a session pertence a outro usuário', async () => {
    mockSessionsRetrieve.mockResolvedValue({
      metadata: { userId: 'user-OTHER' },
      subscription: 'sub_abc',
    });
    const res = await GET(makeRequest('cs_foreign') as any, routeCtx);
    expect(res.status).toBe(403);
    expect(mockSubscriptionFindUnique).not.toHaveBeenCalled();
  });

  it('retorna { subscription: null } quando a session ainda não tem subscription vinculada', async () => {
    mockSessionsRetrieve.mockResolvedValue({
      metadata: { userId: 'user-1' },
      subscription: null,
    });
    const res = await GET(makeRequest('cs_pending') as any, routeCtx);
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ subscription: null });
    expect(mockSubscriptionFindUnique).not.toHaveBeenCalled();
  });

  it('retorna { subscription: null } quando o webhook ainda não persistiu a row', async () => {
    mockSessionsRetrieve.mockResolvedValue({
      metadata: { userId: 'user-1' },
      subscription: 'sub_abc',
    });
    mockSubscriptionFindUnique.mockResolvedValue(null);

    const res = await GET(makeRequest('cs_123') as any, routeCtx);
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ subscription: null });
    expect(mockSubscriptionFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripeSubscriptionId: 'sub_abc' } }),
    );
  });

  it('retorna os dados da subscription quando já persistida', async () => {
    mockSessionsRetrieve.mockResolvedValue({
      metadata: { userId: 'user-1' },
      subscription: 'sub_abc',
    });
    const periodEnd = new Date('2026-05-15T12:00:00Z');
    mockSubscriptionFindUnique.mockResolvedValue({
      status: 'active',
      plan: 'premium',
      billingCycle: 'monthly',
      currentPeriodEnd: periodEnd,
      paymentMethod: 'card',
    });

    const res = await GET(makeRequest('cs_123') as any, routeCtx);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.subscription.status).toBe('active');
    expect(body.subscription.plan).toBe('premium');
    expect(body.subscription.paymentMethod).toBe('card');
  });

  it('aceita session cuja subscription vem expandida (objeto) em vez de string', async () => {
    mockSessionsRetrieve.mockResolvedValue({
      metadata: { userId: 'user-1' },
      subscription: { id: 'sub_expanded' },
    });
    mockSubscriptionFindUnique.mockResolvedValue(null);

    await GET(makeRequest('cs_123') as any, routeCtx);
    expect(mockSubscriptionFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripeSubscriptionId: 'sub_expanded' } }),
    );
  });
});
