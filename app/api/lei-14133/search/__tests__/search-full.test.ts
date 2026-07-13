// @vitest-environment node
/**
 * Testes do caminho completo do POST /api/lei-14133/search:
 * síntese via Gemini → montagem de resultados de artigos + documentos +
 * atos normativos + enunciados. Complementa quota-degradation.test.ts
 * (que cobre o kill-switch). Prisma é mockado com os métodos usados.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockEnforceRateLimit,
  mockEnforceGlobalAiCap,
  mockQueryGeminiText,
  mockDocumentFindMany,
  mockLegislativeActFindMany,
} = vi.hoisted(() => ({
  mockEnforceRateLimit: vi.fn(),
  mockEnforceGlobalAiCap: vi.fn(),
  mockQueryGeminiText: vi.fn(),
  mockDocumentFindMany: vi.fn(),
  mockLegislativeActFindMany: vi.fn(),
}));

vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
  getClientIp: () => '127.0.0.1',
}));
vi.mock('@/lib/cache/ai-quota', () => ({
  enforceGlobalAiCap: (...args: unknown[]) => mockEnforceGlobalAiCap(...args),
}));
vi.mock('@/lib/gemini/cached-client', () => ({
  queryGeminiText: (...args: unknown[]) => mockQueryGeminiText(...args),
}));
vi.mock('@/lib/gemini/config', () => ({ PRIMARY_GEMINI_MODEL: 'gemini-test' }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findMany: (...args: unknown[]) => mockDocumentFindMany(...args) },
    legislativeAct: { findMany: (...args: unknown[]) => mockLegislativeActFindMany(...args) },
  },
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/lei-14133/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Resposta de IA válida citando o Art. 75 (dispensa de licitação — existe nos dados)
const AI_OK = JSON.stringify({
  summary: 'Trata de dispensa de licitação.',
  articles: [{ number: '75', relevance: 'Hipóteses de dispensa', score: 95 }],
});

describe('/api/lei-14133/search — caminho completo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockEnforceGlobalAiCap.mockResolvedValue({ action: 'allow' });
    mockQueryGeminiText.mockResolvedValue({ response: AI_OK, cached: false });
    mockDocumentFindMany.mockResolvedValue([]);
    mockLegislativeActFindMany.mockResolvedValue([]);
  });

  it('valida query curta (< 3 chars) com 400', async () => {
    const res = await POST(makeReq({ query: 'ab' }));
    expect(res.status).toBe(400);
    expect(mockQueryGeminiText).not.toHaveBeenCalled();
  });

  it('sintetiza e monta results a partir dos artigos citados pela IA', async () => {
    const res = await POST(makeReq({ query: 'dispensa de licitação por valor' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isAISearch).toBe(true);
    expect(body.summary).toMatch(/dispensa/i);
    expect(body.results[0].articleNumber).toBe('75');
    expect(body.results[0].score).toBe(95);
  });

  it('inclui documentos e atos normativos vinculados ao artigo, sem duplicar', async () => {
    mockDocumentFindMany.mockResolvedValue([
      { id: 'doc-1', title: 'Manual de Dispensa', category: 'apostila', type: 'pdf', summary: 'resumo', leiArticlesArr: ['75'] },
    ]);
    mockLegislativeActFindMany.mockResolvedValue([
      { id: 'act-1', title: 'IN SEGES 65', type: 'IN', fullNumber: 'IN 65/2021', summary: 'ementa', leiArticlesArr: ['75'] },
    ]);
    const res = await POST(makeReq({ query: 'dispensa licitação' }));
    const body = await res.json();
    const docs = body.documents;
    expect(docs.find((d: { id: string }) => d.id === 'doc-1').relevance).toMatch(/Art\. 75/);
    expect(docs.find((d: { id: string }) => d.id === 'act-1').type).toBe('legislativeAct');
  });

  it('documento sem vínculo de artigo é rotulado como "termos da busca"', async () => {
    mockDocumentFindMany.mockResolvedValue([
      { id: 'doc-x', title: 'Guia geral', category: 'apostila', type: 'pdf', summary: null, leiArticlesArr: [] },
    ]);
    const res = await POST(makeReq({ query: 'licitação pública' }));
    const body = await res.json();
    expect(body.documents[0].relevance).toMatch(/termos da busca/i);
  });

  it('cai no fallback (isAISearch:false) quando a IA devolve JSON inválido', async () => {
    mockQueryGeminiText.mockResolvedValue({ response: 'isto não é json', cached: false });
    const res = await POST(makeReq({ query: 'dispensa de licitação' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isAISearch).toBe(false);
    expect(body.summary).toMatch(/não foi possível|nao foi possivel/i);
    expect(mockDocumentFindMany).not.toHaveBeenCalled();
  });

  it('ordena os artigos por score e rotula ato sem vínculo por termos', async () => {
    // Dois artigos → exercita o sort; score menor citado primeiro deve ir por último
    mockQueryGeminiText.mockResolvedValue({
      response: JSON.stringify({
        summary: 's',
        articles: [
          { number: '74', relevance: 'inexigibilidade', score: 80 },
          { number: '75', relevance: 'dispensa', score: 95 },
        ],
      }),
      cached: false,
    });
    // Ato sem vínculo de artigo, mas casando termo no título
    mockLegislativeActFindMany.mockResolvedValue([
      { id: 'act-nv', title: 'Portaria sobre licitação', type: 'Portaria', fullNumber: 'P 1/2021', summary: null, leiArticlesArr: [] },
    ]);
    const res = await POST(makeReq({ query: 'licitação dispensa inexigibilidade' }));
    const body = await res.json();
    // ordenado por score desc: 95 antes de 80
    expect(body.results.map((r: { score: number }) => r.score)).toEqual([95, 80]);
    expect(body.documents.find((d: { id: string }) => d.id === 'act-nv').relevance).toMatch(/termos da busca/i);
  });

  it('deduplica documentos com o mesmo id (doc e ato colidindo)', async () => {
    mockDocumentFindMany.mockResolvedValue([
      { id: 'dup-1', title: 'Doc', category: 'apostila', type: 'pdf', summary: null, leiArticlesArr: ['75'] },
    ]);
    mockLegislativeActFindMany.mockResolvedValue([
      { id: 'dup-1', title: 'Ato colidente', type: 'IN', fullNumber: 'IN 1', summary: null, leiArticlesArr: ['75'] },
    ]);
    const res = await POST(makeReq({ query: 'dispensa licitação' }));
    const body = await res.json();
    expect(body.documents.filter((d: { id: string }) => d.id === 'dup-1')).toHaveLength(1);
  });

  it('ignora artigos citados pela IA que não existem na base', async () => {
    mockQueryGeminiText.mockResolvedValue({
      response: JSON.stringify({ summary: 's', articles: [{ number: '99999', relevance: 'x', score: 50 }] }),
      cached: false,
    });
    const res = await POST(makeReq({ query: 'tema inexistente qualquer' }));
    const body = await res.json();
    expect(body.results).toHaveLength(0);
    expect(body.isAISearch).toBe(true);
  });
});
