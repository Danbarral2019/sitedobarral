// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockFindMany,
  cacheStore,
  mockIncrementCache,
  mockCaptureMessage,
  mockLoggerInfo,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  cacheStore: new Map<string, unknown>(),
  mockIncrementCache: vi.fn(),
  mockCaptureMessage: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  },
}));

// Cache em memória para exercitar o cache curto de tier sem Redis real.
vi.mock('@/lib/cache/redis-client', () => ({
  getCache: async (key: string) => (cacheStore.has(key) ? cacheStore.get(key) : null),
  setCache: async (key: string, value: unknown) => {
    cacheStore.set(key, value);
  },
  incrementCache: (...args: unknown[]) => mockIncrementCache(...args),
}));

import {
  resolveUserAiTier,
  AI_QUOTA_LIMITS,
  enforceAiQuota,
  enforceGlobalAiCap,
} from '../ai-quota';

describe('resolveUserAiTier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();
    mockFindMany.mockResolvedValue([]);
  });

  it('role=admin → tier admin, sem consultar o banco', async () => {
    const tier = await resolveUserAiTier('u1', 'admin');
    expect(tier).toBe('admin');
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('subscription premium ativa → tier premium', async () => {
    mockFindMany.mockResolvedValue([{ plan: 'premium' }]);
    expect(await resolveUserAiTier('u1', 'student')).toBe('premium');
  });

  it('subscription basico ativa → tier basico', async () => {
    mockFindMany.mockResolvedValue([{ plan: 'basico' }]);
    expect(await resolveUserAiTier('u1', 'student')).toBe('basico');
  });

  it('premium tem precedência sobre basico', async () => {
    mockFindMany.mockResolvedValue([{ plan: 'basico' }, { plan: 'premium' }]);
    expect(await resolveUserAiTier('u1', 'student')).toBe('premium');
  });

  it('sem subscription paga ativa → tier trial', async () => {
    mockFindMany.mockResolvedValue([]);
    expect(await resolveUserAiTier('u1', 'student')).toBe('trial');
  });

  it('consulta o banco filtrando por userId e status active', async () => {
    await resolveUserAiTier('u42', 'student');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'u42', status: 'active' }),
      }),
    );
  });

  it('cacheia o tier: 2ª chamada no mesmo userId não bate no banco', async () => {
    mockFindMany.mockResolvedValue([{ plan: 'premium' }]);

    const first = await resolveUserAiTier('u7', 'student');
    const second = await resolveUserAiTier('u7', 'student');

    expect(first).toBe('premium');
    expect(second).toBe('premium');
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it('admin não usa cache nem banco (bypass por role)', async () => {
    await resolveUserAiTier('u8', 'admin');
    await resolveUserAiTier('u8', 'admin');
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe('enforceAiQuota', () => {
  // now fixo (UTC) para chaves/TTL determinísticos
  const NOW = new Date('2026-07-08T12:00:00.000Z');
  const DAILY = 'ai:quota:d:u1:2026-07-08';
  const MONTHLY = 'ai:quota:m:u1:2026-07';
  const GLOBAL = 'ai:quota:global:2026-07-08';

  // Contadores em memória keyados por chave (robustos à ordem das chamadas):
  // `incrementCache(key)` incrementa e devolve o novo valor, como o Redis incr.
  let counters: Map<string, number>;
  const originalCap = process.env.AI_DAILY_GLOBAL_CAP;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();
    delete process.env.AI_DAILY_GLOBAL_CAP; // default 2000
    mockFindMany.mockResolvedValue([]); // sem subscription → trial (daily 30, monthly 100)
    counters = new Map<string, number>();
    mockIncrementCache.mockImplementation(async (key: string) => {
      const n = (counters.get(key) ?? 0) + 1;
      counters.set(key, n);
      return n;
    });
  });

  afterEach(() => {
    if (originalCap === undefined) delete process.env.AI_DAILY_GLOBAL_CAP;
    else process.env.AI_DAILY_GLOBAL_CAP = originalCap;
  });

  it('dentro da quota diária e mensal → allow', async () => {
    const decision = await enforceAiQuota('u1', 'student', NOW);
    expect(decision).toEqual({ action: 'allow' });
  });

  it('exatamente no teto diário ainda passa (count === limit)', async () => {
    counters.set(DAILY, 29); // próximo incr = 30 (=== limite trial)
    const decision = await enforceAiQuota('u1', 'student', NOW);
    expect(decision).toEqual({ action: 'allow' });
  });

  it('acima do teto diário → degrade-gemini (daily), sem consumir o mensal', async () => {
    counters.set(DAILY, 30); // próximo incr = 31 > 30
    const decision = await enforceAiQuota('u1', 'student', NOW);
    expect(decision).toEqual({ action: 'degrade-gemini', reason: 'daily' });
    // mensal NÃO deve ser incrementado se o diário já estourou
    expect(counters.has(MONTHLY)).toBe(false);
  });

  it('diário ok mas mensal estourado → degrade-gemini (monthly)', async () => {
    counters.set(MONTHLY, 100); // próximo incr = 101 > 100
    const decision = await enforceAiQuota('u1', 'student', NOW);
    expect(decision).toEqual({ action: 'degrade-gemini', reason: 'monthly' });
  });

  it('falha do contador diário degrada para busca sem liberar IA', async () => {
    mockIncrementCache
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error('Redis unavailable'));

    const decision = await enforceAiQuota('u1', 'student', NOW);

    expect(decision).toEqual({ action: 'degrade-search', reason: 'global' });
  });

  it('falha do contador mensal degrada para busca sem liberar IA', async () => {
    mockIncrementCache
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error('Redis unavailable'));

    const decision = await enforceAiQuota('u1', 'student', NOW);

    expect(decision).toEqual({ action: 'degrade-search', reason: 'global' });
  });

  it('admin → allow sem incrementar contador', async () => {
    const decision = await enforceAiQuota('u1', 'admin', NOW);
    expect(decision).toEqual({ action: 'allow' });
    expect(mockIncrementCache).not.toHaveBeenCalled();
  });

  it('usa chaves diária/mensal e TTL corretos', async () => {
    await enforceAiQuota('u9', 'student', NOW);

    const daily = mockIncrementCache.mock.calls.find((c) =>
      String(c[0]).startsWith('ai:quota:d:'),
    );
    const monthly = mockIncrementCache.mock.calls.find((c) =>
      String(c[0]).startsWith('ai:quota:m:'),
    );

    expect(daily?.[0]).toBe('ai:quota:d:u9:2026-07-08');
    expect(monthly?.[0]).toBe('ai:quota:m:u9:2026-07');
    // TTL do dia: até 2026-07-09T00:00Z = 12h = 43200s
    expect(daily?.[1]).toBe(43200);
    // TTL do mês: até 2026-08-01T00:00Z (positivo e maior que o do dia)
    expect(monthly?.[1]).toBeGreaterThan(daily?.[1] as number);
  });

  // ===== T3: kill-switch global de custo =====

  it('global abaixo do cap → incrementa global e segue para o tier (allow)', async () => {
    const decision = await enforceAiQuota('u1', 'student', NOW);
    expect(decision).toEqual({ action: 'allow' });
    expect(counters.get(GLOBAL)).toBe(1);
  });

  it('global acima do cap → degrade-search (global), sem consumir tier', async () => {
    counters.set(GLOBAL, 2000); // default cap 2000 → próximo incr = 2001 > 2000
    const decision = await enforceAiQuota('u1', 'student', NOW);
    expect(decision).toEqual({ action: 'degrade-search', reason: 'global' });
    // tier NÃO deve ser tocado quando o kill-switch global dispara
    expect(counters.has(DAILY)).toBe(false);
    expect(counters.has(MONTHLY)).toBe(false);
  });

  it('alerta Sentry ao cruzar 80% do cap (uma vez), sem degradar', async () => {
    counters.set(GLOBAL, 1599); // próximo incr = 1600 === floor(0.8 * 2000)
    const decision = await enforceAiQuota('u1', 'student', NOW);
    expect(decision).toEqual({ action: 'allow' }); // 1600 < 2000 ainda permite
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    expect(mockCaptureMessage.mock.calls[0][1]).toMatchObject({ level: 'warning' });
  });

  it('não alerta abaixo de 80% do cap', async () => {
    counters.set(GLOBAL, 100);
    await enforceAiQuota('u1', 'student', NOW);
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it('respeita AI_DAILY_GLOBAL_CAP do env', async () => {
    process.env.AI_DAILY_GLOBAL_CAP = '5';
    counters.set(GLOBAL, 5); // próximo incr = 6 > 5
    const decision = await enforceAiQuota('u1', 'student', NOW);
    expect(decision).toEqual({ action: 'degrade-search', reason: 'global' });
  });

  it('admin bypassa o kill-switch global (não incrementa global)', async () => {
    counters.set(GLOBAL, 5000); // muito acima de qualquer cap
    const decision = await enforceAiQuota('u1', 'admin', NOW);
    expect(decision).toEqual({ action: 'allow' });
    expect(counters.get(GLOBAL)).toBe(5000); // inalterado
  });
});

describe('enforceGlobalAiCap (rotas públicas — só Camada C)', () => {
  const NOW = new Date('2026-07-08T12:00:00.000Z');
  const GLOBAL = 'ai:quota:global:2026-07-08';
  let counters: Map<string, number>;
  const originalCap = process.env.AI_DAILY_GLOBAL_CAP;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AI_DAILY_GLOBAL_CAP; // default 2000
    counters = new Map<string, number>();
    mockIncrementCache.mockImplementation(async (key: string) => {
      const n = (counters.get(key) ?? 0) + 1;
      counters.set(key, n);
      return n;
    });
  });

  afterEach(() => {
    if (originalCap === undefined) delete process.env.AI_DAILY_GLOBAL_CAP;
    else process.env.AI_DAILY_GLOBAL_CAP = originalCap;
  });

  it('abaixo do cap → allow e incrementa o global', async () => {
    const decision = await enforceGlobalAiCap(NOW);
    expect(decision).toEqual({ action: 'allow' });
    expect(counters.get(GLOBAL)).toBe(1);
  });

  it('acima do cap → degrade-search (global)', async () => {
    counters.set(GLOBAL, 2000);
    const decision = await enforceGlobalAiCap(NOW);
    expect(decision).toEqual({ action: 'degrade-search', reason: 'global' });
  });

  it('alerta Sentry ao cruzar 80% do cap', async () => {
    counters.set(GLOBAL, 1599); // próximo incr = 1600 === floor(0.8 * 2000)
    await enforceGlobalAiCap(NOW);
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
  });

  it('respeita AI_DAILY_GLOBAL_CAP do env', async () => {
    process.env.AI_DAILY_GLOBAL_CAP = '5';
    counters.set(GLOBAL, 5);
    const decision = await enforceGlobalAiCap(NOW);
    expect(decision).toEqual({ action: 'degrade-search', reason: 'global' });
  });

  it('degrada para busca quando o contador global não pode ser incrementado', async () => {
    mockIncrementCache.mockRejectedValueOnce(new Error('Redis unavailable'));

    const decision = await enforceGlobalAiCap(NOW);

    expect(decision).toEqual({ action: 'degrade-search', reason: 'global' });
  });
});

describe('observabilidade da degradação (T9)', () => {
  const NOW = new Date('2026-07-08T12:00:00.000Z');
  const DAILY = 'ai:quota:d:u1:2026-07-08';
  const MONTHLY = 'ai:quota:m:u1:2026-07';
  const GLOBAL = 'ai:quota:global:2026-07-08';
  let counters: Map<string, number>;
  const originalCap = process.env.AI_DAILY_GLOBAL_CAP;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();
    delete process.env.AI_DAILY_GLOBAL_CAP;
    mockFindMany.mockResolvedValue([]); // trial
    counters = new Map<string, number>();
    mockIncrementCache.mockImplementation(async (key: string) => {
      const n = (counters.get(key) ?? 0) + 1;
      counters.set(key, n);
      return n;
    });
  });

  afterEach(() => {
    if (originalCap === undefined) delete process.env.AI_DAILY_GLOBAL_CAP;
    else process.env.AI_DAILY_GLOBAL_CAP = originalCap;
  });

  /** Filtra chamadas de log pelo evento estruturado de degradação. */
  function degradedLogs(mock: typeof mockLoggerInfo) {
    return mock.mock.calls.filter(
      (c) => (c[0] as { event?: string })?.event === 'ai.quota.degraded',
    );
  }

  it('loga (info, uma vez) ao CRUZAR o teto diário do tier', async () => {
    counters.set(DAILY, 30); // próximo incr = 31 = limite trial + 1 (cruzamento)
    await enforceAiQuota('u1', 'student', NOW);

    const logs = degradedLogs(mockLoggerInfo);
    expect(logs).toHaveLength(1);
    expect(logs[0][0]).toMatchObject({
      event: 'ai.quota.degraded',
      action: 'degrade-gemini',
      reason: 'daily',
      userId: 'u1',
      tier: 'trial',
    });
  });

  it('NÃO re-loga em requisições já acima do teto diário', async () => {
    counters.set(DAILY, 31); // próximo incr = 32 (já cruzou antes)
    await enforceAiQuota('u1', 'student', NOW);
    expect(degradedLogs(mockLoggerInfo)).toHaveLength(0);
  });

  it('loga (info, uma vez) ao cruzar o teto mensal', async () => {
    counters.set(MONTHLY, 100); // próximo incr = 101 = limite + 1
    await enforceAiQuota('u1', 'student', NOW);
    const logs = degradedLogs(mockLoggerInfo);
    expect(logs).toHaveLength(1);
    expect(logs[0][0]).toMatchObject({ action: 'degrade-gemini', reason: 'monthly' });
  });

  it('loga (warn, uma vez) ao cruzar o kill-switch global', async () => {
    counters.set(GLOBAL, 2000); // próximo incr = 2001 = cap + 1
    await enforceAiQuota('u1', 'student', NOW);
    const logs = degradedLogs(mockLoggerWarn);
    expect(logs).toHaveLength(1);
    expect(logs[0][0]).toMatchObject({ action: 'degrade-search', reason: 'global' });
  });

  it('NÃO re-loga o kill-switch global além do cruzamento', async () => {
    counters.set(GLOBAL, 2001); // próximo incr = 2002
    await enforceAiQuota('u1', 'student', NOW);
    expect(degradedLogs(mockLoggerWarn)).toHaveLength(0);
  });

  it('decisão allow não gera log de degradação', async () => {
    await enforceAiQuota('u1', 'student', NOW);
    expect(degradedLogs(mockLoggerInfo)).toHaveLength(0);
    expect(degradedLogs(mockLoggerWarn)).toHaveLength(0);
  });

  it('enforceGlobalAiCap loga warn ao cruzar (rotas públicas)', async () => {
    counters.set(GLOBAL, 2000);
    await enforceGlobalAiCap(NOW);
    expect(degradedLogs(mockLoggerWarn)).toHaveLength(1);
  });
});

describe('AI_QUOTA_LIMITS', () => {
  it('admin é ilimitado (diária e mensal)', () => {
    expect(AI_QUOTA_LIMITS.admin.daily).toBe(Infinity);
    expect(AI_QUOTA_LIMITS.admin.monthly).toBe(Infinity);
  });

  it('tetos por tier conforme desenho alinhado à margem', () => {
    expect(AI_QUOTA_LIMITS.premium).toEqual({ daily: 40, monthly: 250 });
    expect(AI_QUOTA_LIMITS.basico).toEqual({ daily: 20, monthly: 100 });
    expect(AI_QUOTA_LIMITS.trial).toEqual({ daily: 30, monthly: 100 });
  });
});
