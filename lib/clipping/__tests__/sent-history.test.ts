// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDailyClippingSendFindMany } = vi.hoisted(() => ({
  mockDailyClippingSendFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dailyClippingSend: { findMany: (...args: any[]) => mockDailyClippingSendFindMany(...args) },
  },
}));

import {
  parseSentItemsPayload,
  serializeSentItems,
  buildSentItemsPayload,
  getSentIdsInWindow,
} from '../sent-history';

beforeEach(() => {
  mockDailyClippingSendFindMany.mockReset();
});

describe('parseSentItemsPayload — formato legado', () => {
  it('array de strings vira tribunais document-tcu', () => {
    const result = parseSentItemsPayload(JSON.stringify(['doc-1', 'doc-2']));
    expect(result).toEqual([
      { kind: 'document-tcu', id: 'doc-1' },
      { kind: 'document-tcu', id: 'doc-2' },
    ]);
  });

  it('array vazio retorna []', () => {
    expect(parseSentItemsPayload('[]')).toEqual([]);
  });
});

describe('parseSentItemsPayload — formato v2', () => {
  it('parsea payload v2 com itens mistos', () => {
    const raw = JSON.stringify({
      v: 2,
      items: [
        { kind: 'document-tcu', id: 'doc-1' },
        { kind: 'tribunal-decision', id: 'td-1' },
      ],
    });
    expect(parseSentItemsPayload(raw)).toEqual([
      { kind: 'document-tcu', id: 'doc-1' },
      { kind: 'tribunal-decision', id: 'td-1' },
    ]);
  });

  it('filtra entradas com kind inválido', () => {
    const raw = JSON.stringify({
      v: 2,
      items: [
        { kind: 'document-tcu', id: 'doc-1' },
        { kind: 'unknown-kind', id: 'bad' },
        { kind: 'tribunal-decision', id: 'td-1' },
      ],
    });
    expect(parseSentItemsPayload(raw)).toEqual([
      { kind: 'document-tcu', id: 'doc-1' },
      { kind: 'tribunal-decision', id: 'td-1' },
    ]);
  });
});

describe('parseSentItemsPayload — edge cases', () => {
  it('null retorna []', () => {
    expect(parseSentItemsPayload(null)).toEqual([]);
  });

  it('undefined retorna []', () => {
    expect(parseSentItemsPayload(undefined)).toEqual([]);
  });

  it('JSON inválido retorna []', () => {
    expect(parseSentItemsPayload('not json {')).toEqual([]);
  });
});

describe('serializeSentItems', () => {
  it('produz payload v2', () => {
    const json = serializeSentItems([{ kind: 'document-tcu', id: 'doc-1' }]);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual({
      v: 2,
      items: [{ kind: 'document-tcu', id: 'doc-1' }],
    });
  });

  it('round-trip preserva itens', () => {
    const original = [
      { kind: 'document-tcu' as const, id: 'doc-1' },
      { kind: 'tribunal-decision' as const, id: 'td-1' },
    ];
    expect(parseSentItemsPayload(serializeSentItems(original))).toEqual(original);
  });
});

describe('buildSentItemsPayload', () => {
  it('extrai (sourceKind, sourceId) de ClippingItems', () => {
    const json = buildSentItemsPayload([
      { sourceKind: 'document-tcu', sourceId: 'd1' } as any,
      { sourceKind: 'tribunal-decision', sourceId: 't1' } as any,
    ]);
    expect(JSON.parse(json).items).toEqual([
      { kind: 'document-tcu', id: 'd1' },
      { kind: 'tribunal-decision', id: 't1' },
    ]);
  });
});

describe('getSentIdsInWindow', () => {
  it('agrega keys de múltiplos envios', async () => {
    mockDailyClippingSendFindMany.mockResolvedValueOnce([
      { acordaoIdsIncluded: JSON.stringify({ v: 2, items: [{ kind: 'document-tcu', id: 'd1' }] }) },
      { acordaoIdsIncluded: JSON.stringify({ v: 2, items: [{ kind: 'tribunal-decision', id: 't1' }] }) },
    ]);

    const keys = await getSentIdsInWindow(14);
    expect(keys.size).toBe(2);
    expect(keys.has('document-tcu:d1')).toBe(true);
    expect(keys.has('tribunal-decision:t1')).toBe(true);
  });

  it('lida com payload legado (array de strings)', async () => {
    mockDailyClippingSendFindMany.mockResolvedValueOnce([
      { acordaoIdsIncluded: JSON.stringify(['legacy-1', 'legacy-2']) },
    ]);

    const keys = await getSentIdsInWindow(14);
    expect(keys.has('document-tcu:legacy-1')).toBe(true);
    expect(keys.has('document-tcu:legacy-2')).toBe(true);
  });

  it('inclui apenas status success/partial', async () => {
    mockDailyClippingSendFindMany.mockResolvedValueOnce([]);

    await getSentIdsInWindow(14);

    const callArg = mockDailyClippingSendFindMany.mock.calls[0][0];
    expect(callArg.where.status).toEqual({ in: ['success', 'partial'] });
  });

  it('filtra por janela de N dias', async () => {
    mockDailyClippingSendFindMany.mockResolvedValueOnce([]);

    const before = Date.now();
    await getSentIdsInWindow(14);
    const after = Date.now();

    const callArg = mockDailyClippingSendFindMany.mock.calls[0][0];
    const sinceMs = (callArg.where.sentDate.gte as Date).getTime();
    const expectedSinceMs = before - 14 * 24 * 60 * 60 * 1000;
    expect(sinceMs).toBeGreaterThanOrEqual(expectedSinceMs - 1000);
    expect(sinceMs).toBeLessThanOrEqual(after - 14 * 24 * 60 * 60 * 1000 + 1000);
  });
});
