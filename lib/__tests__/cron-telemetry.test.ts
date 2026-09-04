import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const createMock = vi.fn();
const captureExceptionMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: { scraperHealthLog: { create: (...args: unknown[]) => createMock(...args) } },
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

vi.mock('../logger', () => ({
  apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Import APÓS os mocks (vi.mock é hoisted, mas import precisa vir depois para
// garantir que o módulo testado use as versões mockadas).
import { withCronRoute, withCronTelemetry } from '../cron-telemetry';

describe('withCronTelemetry', () => {
  beforeEach(() => {
    createMock.mockReset();
    captureExceptionMock.mockReset();
    createMock.mockResolvedValue({ id: 'log-1' });
  });

  it('persiste status success quando handler resolve sem erros', async () => {
    const stats = { itemsFound: 10, itemsNew: 8, itemsError: 0 };
    const handler = vi.fn().mockResolvedValue(stats);

    const result = await withCronTelemetry('test-cron', handler);

    expect(result).toEqual(stats);
    expect(handler).toHaveBeenCalledOnce();
    expect(captureExceptionMock).not.toHaveBeenCalled();

    expect(createMock).toHaveBeenCalledOnce();
    const call = createMock.mock.calls[0][0];
    expect(call.data.scraperCode).toBe('test-cron');
    expect(call.data.status).toBe('success');
    expect(call.data.itemsFound).toBe(10);
    expect(call.data.itemsNew).toBe(8);
    expect(call.data.itemsError).toBe(0);
    expect(call.data.duration).toBeGreaterThanOrEqual(0);
    expect(call.data.errorMessage).toBeNull();
  });

  it('persiste status partial_failure quando itemsError > 0', async () => {
    const handler = vi.fn().mockResolvedValue({ itemsFound: 5, itemsNew: 3, itemsError: 2 });

    await withCronTelemetry('test-cron', handler);

    const call = createMock.mock.calls[0][0];
    expect(call.data.status).toBe('partial_failure');
    expect(call.data.itemsError).toBe(2);
  });

  it('aceita handler que retorna void (cron sem trabalho)', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);

    await withCronTelemetry('test-cron', handler);

    const call = createMock.mock.calls[0][0];
    expect(call.data.status).toBe('success');
    expect(call.data.itemsFound).toBe(0);
    expect(call.data.itemsNew).toBe(0);
  });

  it('captura Sentry, persiste failure e RE-LANÇA em caso de erro', async () => {
    const error = new Error('Gemini timeout');
    const handler = vi.fn().mockRejectedValue(error);

    await expect(withCronTelemetry('test-cron', handler)).rejects.toThrow('Gemini timeout');

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const sentryCall = captureExceptionMock.mock.calls[0];
    expect(sentryCall[0]).toBe(error);
    expect(sentryCall[1].tags).toEqual({ cron: 'test-cron' });
    expect(sentryCall[1].contexts.cron.scraperCode).toBe('test-cron');

    expect(createMock).toHaveBeenCalledOnce();
    const healthCall = createMock.mock.calls[0][0];
    expect(healthCall.data.status).toBe('failure');
    expect(healthCall.data.errorMessage).toBe('Gemini timeout');
  });

  it('trunca errorMessage longa em 2000 chars', async () => {
    const longMsg = 'x'.repeat(5000);
    const handler = vi.fn().mockRejectedValue(new Error(longMsg));

    await expect(withCronTelemetry('test-cron', handler)).rejects.toThrow();

    const call = createMock.mock.calls[0][0];
    expect(call.data.errorMessage).toHaveLength(2000);
  });

  it('NÃO bloqueia cron quando persistência de health log falha', async () => {
    createMock.mockRejectedValueOnce(new Error('DB connection lost'));
    const handler = vi.fn().mockResolvedValue({ itemsFound: 5 });

    const result = await withCronTelemetry('test-cron', handler);

    expect(result).toEqual({ itemsFound: 5 });
    // health log falhou mas cron retornou com sucesso
  });

  it('serializa metadata como JSON string', async () => {
    const handler = vi.fn().mockResolvedValue({
      itemsFound: 1,
      metadata: { batchSize: 500, source: 'tcu-api' },
    });

    await withCronTelemetry('test-cron', handler);

    const call = createMock.mock.calls[0][0];
    expect(call.data.metadata).toBe('{"batchSize":500,"source":"tcu-api"}');
  });
});

describe('withCronRoute', () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({ id: 'log-1' });
  });

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
  });

  it('retorna erro de configuração e não executa o cron quando CRON_SECRET não existe', async () => {
    delete process.env.CRON_SECRET;
    const handler = vi.fn().mockResolvedValue({ itemsFound: 1 });
    const wrappedCron = withCronRoute('test-route', handler);

    const response = await wrappedCron(new NextRequest('http://localhost/api/cron/test'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'CRON_SECRET não configurado' });
    expect(handler).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });
});
