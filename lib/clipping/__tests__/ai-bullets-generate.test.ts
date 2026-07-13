// @vitest-environment node
/**
 * Testes das funções de geração de bullets via Gemini (fetch direto):
 * generateAiBullets (TCU, por dispositivos) e generateAiBulletsForTribunal
 * (TCE por inteiro teor). Cobre sem-API-key, erro HTTP, safety block,
 * sucesso (parse) e exceção. fetch/Sentry mockados.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/gemini/config', () => ({ PRIMARY_GEMINI_MODEL: 'gemini-test' }));

import { generateAiBullets, generateAiBulletsForTribunal } from '../ai-bullets';
import type { ClippingItem } from '../sources/types';

const ORIGINAL_ENV = process.env;
const mockFetch = vi.fn();

function geminiOk(bullets: string[]) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ bullets }) }] } }] }),
  };
}

function makeTribunalItem(over: Partial<ClippingItem> = {}): ClippingItem {
  return {
    sourceKind: 'tribunal-decision', sourceId: 'td-1', tribunalCode: 'TCE-PE', tribunalName: 'TCE-PE',
    decisionType: 'parecer', decisionNumber: '698/26', title: 't', dataJulgamento: null,
    relator: null, orgaoJulgador: null, ementa: 'ementa', fullText: 'x'.repeat(1200),
    linkExternal: null, linkPdf: null, relevanceScore: 80, publishedAt: new Date(), ...over,
  };
}

const tcuInput = { ementa: 'ementa', inteiroTeor: 'teor'.repeat(100), dispositivos: [] };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, GEMINI_API_KEY: 'test-key' };
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});
afterEach(() => {
  process.env = ORIGINAL_ENV;
  vi.unstubAllGlobals();
});

describe('generateAiBullets (TCU)', () => {
  it('retorna [] e não chama fetch sem GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;
    expect(await generateAiBullets(tcuInput)).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('parseia os bullets no caminho de sucesso', async () => {
    mockFetch.mockResolvedValueOnce(geminiOk([
      'O tribunal fixou tese sobre dispensa de licitação por valor.',
      'Gestores devem observar o limite atualizado antes de contratar.',
    ]));
    const out = await generateAiBullets(tcuInput);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/dispensa de licitação/);
  });

  it('retorna [] em erro HTTP do Gemini', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' });
    expect(await generateAiBullets(tcuInput)).toEqual([]);
  });

  it('retorna [] quando o Gemini bloqueia por safety', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) });
    expect(await generateAiBullets(tcuInput)).toEqual([]);
  });

  it('retorna [] quando não há texto na resposta', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [] }) });
    expect(await generateAiBullets(tcuInput)).toEqual([]);
  });

  it('retorna [] quando o fetch lança exceção', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));
    expect(await generateAiBullets(tcuInput)).toEqual([]);
  });
});

describe('generateAiBulletsForTribunal (TCE)', () => {
  it('retorna [] sem chamar fetch quando o item não qualifica (fullText curto)', async () => {
    expect(await generateAiBulletsForTribunal(makeTribunalItem({ fullText: 'curto' }))).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retorna [] sem GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;
    expect(await generateAiBulletsForTribunal(makeTribunalItem())).toEqual([]);
  });

  it('parseia bullets no sucesso (trunca inteiro teor muito longo)', async () => {
    mockFetch.mockResolvedValueOnce(geminiOk([
      'O TCE-PE consolidou entendimento sobre fiscalização de contratos continuados.',
    ]));
    const out = await generateAiBulletsForTribunal(makeTribunalItem({ fullText: 'y'.repeat(20000) }));
    expect(out).toHaveLength(1);
  });

  it('retorna [] em erro HTTP', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'rate' });
    expect(await generateAiBulletsForTribunal(makeTribunalItem())).toEqual([]);
  });

  it('retorna [] em safety block', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ promptFeedback: { blockReason: 'OTHER' } }) });
    expect(await generateAiBulletsForTribunal(makeTribunalItem())).toEqual([]);
  });

  it('retorna [] quando o fetch lança', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'));
    expect(await generateAiBulletsForTribunal(makeTribunalItem())).toEqual([]);
  });
});
