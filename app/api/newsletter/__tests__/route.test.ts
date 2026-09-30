// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Rotas públicas da newsletter: inscrição (double opt-in), endpoint antigo de
 * descadastro por `?email=` e descadastro por link assinado.
 */

const h = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  sendEmail: vi.fn(async () => ({ success: true })),
  checkRateLimit: vi.fn(async () => ({ allowed: true, limit: 10, remaining: 9, reset: 0 })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    newsletterSubscriber: {
      findFirst: h.findFirst,
      findUnique: h.findUnique,
      create: h.create,
      update: h.update,
      updateMany: h.updateMany,
      findMany: vi.fn(async () => []),
    },
  },
}));
vi.mock('@/lib/logger', () => {
  const logger = {
    child: () => logger,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return { apiLogger: logger, authLogger: logger };
});
vi.mock('@/lib/email', () => ({ sendEmail: h.sendEmail }));
vi.mock('@/lib/cache/redis-client', () => ({ checkRateLimit: h.checkRateLimit }));
vi.mock('@/lib/mailchimp', () => ({
  addSubscriber: vi.fn(async () => ({ success: true })),
  unsubscribeSubscriber: vi.fn(async () => ({ success: true })),
  isMailChimpConfigured: () => false,
}));

import { POST, DELETE } from '../route';
import { POST as UNSUBSCRIBE_POST, GET as UNSUBSCRIBE_GET } from '../unsubscribe/route';
import { POST as CONFIRM_POST } from '../confirm/route';
import { signConfirmationToken, signUnsubscribeToken } from '@/lib/newsletter/tokens';

const ID = '4f1c2b7e-8d0a-4a35-9b6e-1c2d3e4f5a6b';

function subscriber(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    email: 'alguem@exemplo.com',
    name: null,
    interests: null,
    source: null,
    isActive: true,
    subscribedAt: new Date('2025-01-01T00:00:00Z'),
    unsubscribedAt: null,
    confirmedAt: null,
    confirmationSentAt: null,
    ...overrides,
  };
}

function postSubscribe(body: unknown) {
  return new NextRequest('https://exemplo.test/api/newsletter', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify(body),
  });
}

const noParams = { params: Promise.resolve({}) };

describe('POST /api/newsletter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => subscriber(data));
  });

  it('e-mail novo: cria pendente, envia confirmação e responde de forma genérica', async () => {
    h.findFirst.mockResolvedValue(null);
    h.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => subscriber(data));

    const res = await POST(postSubscribe({ email: 'Novo@Exemplo.com', name: 'Novo' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pendingConfirmation).toBe(true);

    expect(h.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'novo@exemplo.com', isActive: true, confirmedAt: null }),
    });
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('e-mail já confirmado recebe exatamente a mesma resposta, sem e-mail', async () => {
    h.findFirst.mockResolvedValue(null);
    h.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => subscriber(data));
    const novo = await POST(postSubscribe({ email: 'a@exemplo.com' }));
    const corpoNovo = await novo.json();

    vi.clearAllMocks();
    h.findFirst.mockResolvedValue(subscriber({ email: 'a@exemplo.com', confirmedAt: new Date() }));
    const existente = await POST(postSubscribe({ email: 'a@exemplo.com' }));

    expect(existente.status).toBe(novo.status);
    expect(await existente.json()).toEqual(corpoNovo);
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(h.create).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });

  it('e-mail inválido responde 400 sem tocar o banco', async () => {
    const res = await POST(postSubscribe({ email: 'nao-e-email' }));
    expect(res.status).toBe(400);
    expect(h.findFirst).not.toHaveBeenCalled();
  });

  it('limite por IP responde 429', async () => {
    h.checkRateLimit.mockResolvedValueOnce({ allowed: false, limit: 10, remaining: 0, reset: 0 });
    const res = await POST(postSubscribe({ email: 'a@exemplo.com' }));
    expect(res.status).toBe(429);
    expect(h.findFirst).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/newsletter?email= (endpoint antigo)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('não descadastra e responde de forma genérica', async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/rodapé/);
    expect(h.update).not.toHaveBeenCalled();
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.findFirst).not.toHaveBeenCalled();
  });
});

describe('POST /api/newsletter/unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.findUnique.mockResolvedValue(subscriber({ confirmedAt: new Date() }));
    h.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => subscriber(data));
  });

  it('token válido no corpo JSON cancela a inscrição', async () => {
    const req = new NextRequest('https://exemplo.test/api/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: signUnsubscribeToken(ID) }),
    });
    const res = await UNSUBSCRIBE_POST(req, noParams);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'unsubscribed' });
    expect(h.update).toHaveBeenCalledWith({
      where: { id: ID },
      data: expect.objectContaining({ isActive: false }),
    });
  });

  it('descadastro em um clique (RFC 8058): token na URL e corpo de formulário', async () => {
    const url = `https://exemplo.test/api/newsletter/unsubscribe?token=${encodeURIComponent(signUnsubscribeToken(ID))}`;
    const req = new NextRequest(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    });
    const res = await UNSUBSCRIBE_POST(req, noParams);
    expect(res.status).toBe(200);
    expect(h.update).toHaveBeenCalledTimes(1);
  });

  it('token inválido, de outro propósito ou ausente não altera nada', async () => {
    const valido = signUnsubscribeToken(ID);
    const adulterado = valido.slice(0, -2) + (valido.endsWith('AA') ? 'BB' : 'AA');
    for (const token of [adulterado, signConfirmationToken(ID), 'alguem@exemplo.com', undefined]) {
      const req = new NextRequest('https://exemplo.test/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const res = await UNSUBSCRIBE_POST(req, noParams);
      expect(res.status).toBe(400);
    }
    expect(h.update).not.toHaveBeenCalled();
  });

  it('GET não descadastra: redireciona para a página que pede o clique', async () => {
    const token = signUnsubscribeToken(ID);
    const req = new NextRequest(`https://exemplo.test/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
    const res = await UNSUBSCRIBE_GET(req);
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/cancelar-newsletter');
    expect(location.searchParams.get('token')).toBe(token);
    expect(h.update).not.toHaveBeenCalled();
  });
});

describe('confirmação da inscrição: GET só valida, POST confirma', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.findUnique.mockResolvedValue(subscriber({ confirmedAt: null }));
    h.updateMany.mockResolvedValue({ count: 1 });
  });

  function postConfirm(token: unknown) {
    return new NextRequest('https://exemplo.test/api/newsletter/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  }

  it('GET da página /confirmar-newsletter não confirma: mostra o botão', async () => {
    const { default: Page } = await import('@/app/confirmar-newsletter/page');
    const { default: ConfirmButton } = await import('@/app/confirmar-newsletter/ConfirmButton');
    const token = signConfirmationToken(ID);

    const el = (await Page({ searchParams: Promise.resolve({ token }) })) as {
      type: unknown;
      props: { token: string };
    };
    expect(el.type).toBe(ConfirmButton);
    expect(el.props.token).toBe(token);
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });

  it('GET da página com link expirado, inválido ou já confirmado não mostra o botão', async () => {
    const { default: Page } = await import('@/app/confirmar-newsletter/page');
    const { ConfirmOutcome } = await import('@/app/confirmar-newsletter/ConfirmButton');

    const expirado = signConfirmationToken(ID, new Date(Date.now() - 73 * 3600 * 1000));
    const casos: Array<[string | undefined, string]> = [
      [expirado, 'expired'],
      ['lixo.lixo', 'invalid'],
      [undefined, 'invalid'],
    ];
    for (const [token, status] of casos) {
      const el = (await Page({ searchParams: Promise.resolve({ token }) })) as {
        type: unknown;
        props: { status: string };
      };
      expect(el.type).toBe(ConfirmOutcome);
      expect(el.props.status).toBe(status);
    }

    h.findUnique.mockResolvedValue(subscriber({ confirmedAt: new Date() }));
    const el = (await Page({ searchParams: Promise.resolve({ token: signConfirmationToken(ID) }) })) as {
      props: { status: string };
    };
    expect(el.props.status).toBe('already');
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it('POST com token válido confirma', async () => {
    const res = await CONFIRM_POST(postConfirm(signConfirmationToken(ID)), noParams);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'confirmed' });
    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: ID, isActive: true, confirmedAt: null },
      data: { confirmedAt: expect.any(Date) },
    });
  });

  it('POST de inscrição já confirmada responde "already" sem alterar', async () => {
    h.findUnique.mockResolvedValue(subscriber({ confirmedAt: new Date() }));
    const res = await CONFIRM_POST(postConfirm(signConfirmationToken(ID)), noParams);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'already' });
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it('POST com token expirado não confirma', async () => {
    const expirado = signConfirmationToken(ID, new Date(Date.now() - 73 * 3600 * 1000));
    const res = await CONFIRM_POST(postConfirm(expirado), noParams);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: 'expired' });
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it('POST com token adulterado, de outro propósito ou ausente não confirma', async () => {
    const valido = signConfirmationToken(ID);
    const adulterado = valido.slice(0, -2) + (valido.endsWith('AA') ? 'BB' : 'AA');
    for (const token of [adulterado, signUnsubscribeToken(ID), undefined]) {
      const res = await CONFIRM_POST(postConfirm(token), noParams);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ status: 'invalid' });
    }
    expect(h.updateMany).not.toHaveBeenCalled();
  });
});
