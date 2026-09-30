// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Newsletter mensal com double opt-in: só inscritos ativos e confirmados
 * recebem, e cada e-mail leva o link assinado de descadastro no rodapé e nos
 * cabeçalhos List-Unsubscribe. IA e Resend são simulados.
 */

interface Sub {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  confirmedAt: Date | null;
}

const h = vi.hoisted(() => {
  const base: Sub[] = [];
  return {
    subs: base,
    subscriberFindMany: vi.fn(),
    send: vi.fn(async () => ({ data: { id: 'email-1' }, error: null })),
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findMany: vi.fn(async () => []) },
    tribunalDecision: { findMany: vi.fn(async () => []) },
    blogPost: {
      findMany: vi.fn(async () => [
        { title: 'Post do mês', slug: 'post-do-mes', excerpt: 'Resumo', publishedAt: new Date() },
      ]),
    },
    publication: { findMany: vi.fn(async () => []) },
    courseVideo: { findMany: vi.fn(async () => []) },
    legislativeAct: { findMany: vi.fn(async () => []) },
    newsletterSend: { create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) },
    newsletterSubscriber: { findMany: h.subscriberFindMany },
  },
}));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: h.send };
  },
}));
vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: () => null }));
vi.mock('@/lib/cron-telemetry', () => ({
  withCronTelemetry: async (_name: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock('@/lib/newsletter/relevance-filter', () => ({
  filterByRelevance: vi.fn(async () => ({ selected: [], totalEvaluated: 0, totalSelected: 0 })),
}));
vi.mock('@/lib/newsletter/intro-generator', () => ({
  generateNewsletterIntro: vi.fn(async () => '<p>Introdução</p>'),
}));

import { GET } from '../monthly-newsletter/route';
import { verifyUnsubscribeToken } from '@/lib/newsletter/tokens';

function matchesWhere(s: Sub, where: Record<string, unknown>): boolean {
  if ('isActive' in where && s.isActive !== where.isActive) return false;
  if ('confirmedAt' in where) {
    const c = where.confirmedAt as { not?: null } | null;
    if (c === null && s.confirmedAt !== null) return false;
    if (c && 'not' in c && s.confirmedAt === null) return false;
  }
  return true;
}

describe('cron monthly-newsletter e o double opt-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    h.subs.length = 0;
    h.subs.push(
      // Inscrito legado: a migração preencheu confirmedAt com subscribedAt
      { id: 'legado-0001', email: 'legado@exemplo.com', name: 'Legado', isActive: true, confirmedAt: new Date('2024-05-01') },
      { id: 'confirm-0002', email: 'confirmado@exemplo.com', name: null, isActive: true, confirmedAt: new Date() },
      { id: 'pendente-0003', email: 'pendente@exemplo.com', name: 'Pendente', isActive: true, confirmedAt: null },
      { id: 'cancelad-0004', email: 'cancelado@exemplo.com', name: null, isActive: false, confirmedAt: new Date('2024-05-01') },
    );
    h.subscriberFindMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      h.subs.filter((s) => matchesWhere(s, where)).map(({ id, email, name }) => ({ id, email, name })),
    );
  });

  it('envia só para ativos confirmados, com descadastro assinado por inscrito', async () => {
    const req = new Request('https://exemplo.test/api/cron/monthly-newsletter') as unknown as import('next/server').NextRequest;
    Object.defineProperty(req, 'nextUrl', { value: new URL(req.url) });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const where = h.subscriberFindMany.mock.calls[0][0].where;
    expect(where).toEqual({ isActive: true, confirmedAt: { not: null } });

    const calls = h.send.mock.calls as unknown as Array<[{ to: string; html: string; headers: Record<string, string> }]>;
    expect(calls.map(([o]) => o.to).sort()).toEqual(['confirmado@exemplo.com', 'legado@exemplo.com']);

    for (const [opts] of calls) {
      const sub = h.subs.find((s) => s.email === opts.to)!;

      // Rodapé: link da página de descadastro com token do próprio inscrito
      const m = opts.html.match(/href="([^"]*\/cancelar-newsletter\?token=[^"]+)"/);
      expect(m).not.toBeNull();
      const footerToken = new URL(m![1].replace(/&amp;/g, '&')).searchParams.get('token');
      expect(verifyUnsubscribeToken(footerToken)).toBe(sub.id);
      expect(opts.html).not.toContain('{{UNSUBSCRIBE_URL}}');
      expect(opts.html).not.toContain('{{NAME}}');
      expect(opts.html).not.toContain('/newsletter/unsubscribe');

      // Cabeçalhos de descadastro em um clique
      expect(opts.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
      const headerUrl = opts.headers['List-Unsubscribe'].replace(/^<|>$/g, '');
      expect(new URL(headerUrl).pathname).toBe('/api/newsletter/unsubscribe');
      expect(verifyUnsubscribeToken(new URL(headerUrl).searchParams.get('token'))).toBe(sub.id);
    }
  }, 15_000);
});
