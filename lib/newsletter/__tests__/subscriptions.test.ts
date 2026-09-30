// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Double opt-in e descadastro por link assinado (lib/newsletter/subscriptions.ts).
 * Prisma, e-mail, MailChimp e Redis são simulados: nada sai da máquina.
 */

interface Row {
  id: string;
  email: string;
  name: string | null;
  interests: string | null;
  source: string | null;
  isActive: boolean;
  subscribedAt: Date;
  unsubscribedAt: Date | null;
  confirmedAt: Date | null;
  confirmationSentAt: Date | null;
}

const h = vi.hoisted(() => {
  const rows = new Map<string, Row>();
  let seq = 0;
  const matches = (row: Row, where: Record<string, unknown>) => {
    if ('id' in where && row.id !== where.id) return false;
    if ('isActive' in where && row.isActive !== where.isActive) return false;
    if ('confirmedAt' in where) {
      const c = where.confirmedAt;
      if (c === null && row.confirmedAt !== null) return false;
      if (c && typeof c === 'object' && 'not' in c && row.confirmedAt === null) return false;
    }
    return true;
  };
  const prisma = {
    newsletterSubscriber: {
      findFirst: vi.fn(async ({ where }: { where: { email: { equals: string } } }) => {
        for (const r of rows.values()) {
          if (r.email.toLowerCase() === where.email.equals.toLowerCase()) return { ...r };
        }
        return null;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const r = rows.get(where.id);
        return r ? { ...r } : null;
      }),
      create: vi.fn(async ({ data }: { data: Partial<Row> }) => {
        const row: Row = {
          id: `sub-${++seq}-0000`,
          email: data.email!,
          name: data.name ?? null,
          interests: data.interests ?? null,
          source: data.source ?? null,
          isActive: data.isActive ?? true,
          subscribedAt: new Date(),
          unsubscribedAt: null,
          confirmedAt: data.confirmedAt ?? null,
          confirmationSentAt: null,
        };
        rows.set(row.id, row);
        return { ...row };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const r = rows.get(where.id);
        if (!r) throw new Error('not found');
        Object.assign(r, data);
        return { ...r };
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
        let count = 0;
        for (const r of rows.values()) {
          if (matches(r, where)) {
            Object.assign(r, data);
            count++;
          }
        }
        return { count };
      }),
    },
  };
  return {
    rows,
    prisma,
    sendEmail: vi.fn(async () => ({ success: true })),
    checkRateLimit: vi.fn(async () => ({ allowed: true, limit: 3, remaining: 2, reset: 0 })),
    addSubscriber: vi.fn(async () => ({ success: true })),
    unsubscribeSubscriber: vi.fn(async () => ({ success: true })),
    isMailChimpConfigured: vi.fn(() => true),
    reset() {
      rows.clear();
      seq = 0;
    },
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: h.prisma }));
vi.mock('@/lib/email', () => ({ sendEmail: h.sendEmail }));
vi.mock('@/lib/cache/redis-client', () => ({ checkRateLimit: h.checkRateLimit }));
vi.mock('@/lib/mailchimp', () => ({
  addSubscriber: h.addSubscriber,
  unsubscribeSubscriber: h.unsubscribeSubscriber,
  isMailChimpConfigured: h.isMailChimpConfigured,
}));

import {
  CONFIRMATION_RESEND_COOLDOWN_MS,
  confirmNewsletterSubscription,
  requestNewsletterSubscription,
  unsubscribeNewsletterByToken,
} from '../subscriptions';
import { CONFIRMED_SUBSCRIBER_WHERE } from '../filters';
import { signConfirmationToken, signUnsubscribeToken } from '../tokens';

function seed(partial: Partial<Row> & { email: string }): Row {
  const row: Row = {
    id: `seed-${h.rows.size + 1}-0000`,
    name: null,
    interests: null,
    source: null,
    isActive: true,
    subscribedAt: new Date('2025-01-10T10:00:00Z'),
    unsubscribedAt: null,
    confirmedAt: null,
    confirmationSentAt: null,
    ...partial,
  };
  h.rows.set(row.id, row);
  return row;
}

function confirmUrlFromLastEmail(): string {
  const call = h.sendEmail.mock.calls.at(-1) as unknown as [{ text: string }];
  const match = call[0].text.match(/https?:\/\/\S+\/confirmar-newsletter\?token=\S+/);
  expect(match).not.toBeNull();
  return match![0];
}

describe('requestNewsletterSubscription (double opt-in)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.reset();
  });

  it('e-mail novo fica pendente e recebe o link de confirmação', async () => {
    await requestNewsletterSubscription({ email: '  Fulano@Exemplo.com ', name: 'Fulano' });

    const [row] = [...h.rows.values()];
    expect(row.email).toBe('fulano@exemplo.com');
    expect(row.isActive).toBe(true);
    expect(row.confirmedAt).toBeNull();
    expect(row.confirmationSentAt).toBeInstanceOf(Date);

    expect(h.sendEmail).toHaveBeenCalledTimes(1);
    const [opts] = h.sendEmail.mock.calls[0] as unknown as [{ to: string; subject: string }];
    expect(opts.to).toBe('fulano@exemplo.com');
    expect(opts.subject).toMatch(/Confirme/);
    expect(confirmUrlFromLastEmail()).toContain('/confirmar-newsletter?token=');

    // MailChimp só entra na confirmação
    expect(h.addSubscriber).not.toHaveBeenCalled();
  });

  it('e-mail já confirmado: não envia nada nem altera o registro', async () => {
    const row = seed({ email: 'ja@exemplo.com', confirmedAt: new Date('2025-01-10T10:00:00Z') });
    const snapshot = { ...row };

    await requestNewsletterSubscription({ email: 'JA@exemplo.com', name: 'Invasor' });

    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(h.prisma.newsletterSubscriber.update).not.toHaveBeenCalled();
    expect(h.rows.get(row.id)).toEqual(snapshot);
  });

  it('pendente dentro do intervalo mínimo não recebe outro e-mail', async () => {
    seed({ email: 'p@exemplo.com', confirmationSentAt: new Date(Date.now() - 60_000) });
    await requestNewsletterSubscription({ email: 'p@exemplo.com' });
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it('pendente depois do intervalo mínimo recebe a confirmação de novo', async () => {
    const row = seed({
      email: 'p@exemplo.com',
      confirmationSentAt: new Date(Date.now() - CONFIRMATION_RESEND_COOLDOWN_MS - 1000),
    });
    await requestNewsletterSubscription({ email: 'p@exemplo.com' });
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
    expect(h.rows.get(row.id)!.confirmedAt).toBeNull();
  });

  it('respeita o limite por e-mail no Redis', async () => {
    h.checkRateLimit.mockResolvedValueOnce({ allowed: false, limit: 3, remaining: 0, reset: 0 });
    await requestNewsletterSubscription({ email: 'novo@exemplo.com' });
    expect(h.checkRateLimit).toHaveBeenCalledWith('newsletter:confirm:novo@exemplo.com', 3, 3600);
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it('reinscrição de cancelado volta a pendente e exige nova confirmação', async () => {
    const row = seed({
      email: 'volta@exemplo.com',
      isActive: false,
      confirmedAt: new Date('2025-01-10T10:00:00Z'),
      unsubscribedAt: new Date('2025-05-01T10:00:00Z'),
    });
    await requestNewsletterSubscription({ email: 'volta@exemplo.com' });

    const atual = h.rows.get(row.id)!;
    expect(atual.isActive).toBe(true);
    expect(atual.confirmedAt).toBeNull();
    expect(atual.unsubscribedAt).toBeNull();
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe('confirmNewsletterSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.reset();
  });

  it('link válido confirma o inscrito e sincroniza com o MailChimp', async () => {
    await requestNewsletterSubscription({ email: 'c@exemplo.com', name: 'Maria Silva' });
    const token = new URL(confirmUrlFromLastEmail()).searchParams.get('token');

    expect(await confirmNewsletterSubscription(token)).toBe('confirmed');
    const [row] = [...h.rows.values()];
    expect(row.confirmedAt).toBeInstanceOf(Date);
    expect(h.addSubscriber).toHaveBeenCalledWith('c@exemplo.com', 'Maria', 'Silva', undefined);

    // Segundo clique: nada muda
    expect(await confirmNewsletterSubscription(token)).toBe('already');
  });

  it('link expirado não confirma', async () => {
    const row = seed({ email: 'x@exemplo.com' });
    const token = signConfirmationToken(row.id, new Date(Date.now() - 73 * 3600 * 1000));
    expect(await confirmNewsletterSubscription(token)).toBe('expired');
    expect(h.rows.get(row.id)!.confirmedAt).toBeNull();
  });

  it('link adulterado não confirma', async () => {
    const row = seed({ email: 'x@exemplo.com' });
    const token = signConfirmationToken(row.id);
    const adulterado = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
    expect(await confirmNewsletterSubscription(adulterado)).toBe('invalid');
    expect(await confirmNewsletterSubscription(signUnsubscribeToken(row.id))).toBe('invalid');
    expect(h.rows.get(row.id)!.confirmedAt).toBeNull();
  });

  it('não reativa quem cancelou depois de pedir a inscrição', async () => {
    const row = seed({ email: 'x@exemplo.com', isActive: false });
    expect(await confirmNewsletterSubscription(signConfirmationToken(row.id))).toBe('invalid');
    expect(h.rows.get(row.id)!.confirmedAt).toBeNull();
  });
});

describe('unsubscribeNewsletterByToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.reset();
  });

  it('assinatura válida cancela a inscrição', async () => {
    const row = seed({ email: 'u@exemplo.com', confirmedAt: new Date() });
    expect(await unsubscribeNewsletterByToken(signUnsubscribeToken(row.id))).toBe('unsubscribed');
    const atual = h.rows.get(row.id)!;
    expect(atual.isActive).toBe(false);
    expect(atual.unsubscribedAt).toBeInstanceOf(Date);
    expect(h.unsubscribeSubscriber).toHaveBeenCalledWith('u@exemplo.com');

    expect(await unsubscribeNewsletterByToken(signUnsubscribeToken(row.id))).toBe('already');
  });

  it('assinatura inválida não altera nada', async () => {
    const row = seed({ email: 'u@exemplo.com', confirmedAt: new Date() });
    const token = signUnsubscribeToken(row.id);
    const adulterado = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');

    for (const t of [adulterado, signConfirmationToken(row.id), '', undefined, 'u@exemplo.com']) {
      expect(await unsubscribeNewsletterByToken(t)).toBe('invalid');
    }
    expect(h.rows.get(row.id)!.isActive).toBe(true);
    expect(h.prisma.newsletterSubscriber.update).not.toHaveBeenCalled();
  });
});

describe('compatibilidade dos inscritos atuais', () => {
  it('inscrito anterior ao double opt-in (confirmedAt = subscribedAt pela migração) segue elegível', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const sql = readFileSync(
      join(process.cwd(), 'prisma/migrations/20260930150000_newsletter_double_opt_in/migration.sql'),
      'utf-8',
    );
    expect(sql).toMatch(/UPDATE "NewsletterSubscriber"\s+SET "confirmedAt" = "subscribedAt"\s+WHERE "confirmedAt" IS NULL;/);

    // Filtro de envio: ativo + confirmado. Um inscrito legado migrado passa;
    // pendente e cancelado não.
    expect(CONFIRMED_SUBSCRIBER_WHERE).toEqual({ isActive: true, confirmedAt: { not: null } });
  });
});
