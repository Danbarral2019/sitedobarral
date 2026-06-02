// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do cliente Gemini ANTES do import do módulo testado (vi.mock é hoisted,
// então usamos vi.hoisted para que o mock fn exista no momento do mock).
const { queryGeminiTextMock } = vi.hoisted(() => ({
  queryGeminiTextMock: vi.fn(),
}));
vi.mock('@/lib/gemini/cached-client', () => ({
  queryGeminiText: queryGeminiTextMock,
}));
vi.mock('@/lib/gemini/config', () => ({
  PRIMARY_GEMINI_MODEL: 'gemini-2.5-flash',
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { filterByRelevance, type DecisionInput } from '../relevance-filter';

function makeDecision(i: number): DecisionInput {
  return {
    id: `dec-${i}`,
    title: `Decisão ${i}`,
    description: `Ementa fictícia da decisão ${i} sobre dispensa de licitação.`,
    ementa: `Ementa ${i}`,
    summary: null,
    tribunalCode: 'TCU',
    category: 'tribunal-decisions',
  };
}

function makeBatchResponse(decisions: DecisionInput[]) {
  return {
    response: JSON.stringify({
      evaluations: decisions.map((d) => ({
        id: d.id,
        relevanceScore: 75,
        aiSummary: `Resumo para ${d.id}`,
        themes: ['licitação'],
        leiArticles: ['75'],
      })),
    }),
    latency: 100,
  };
}

describe('filterByRelevance', () => {
  beforeEach(() => {
    queryGeminiTextMock.mockReset();
  });

  it('inclui todas as decisões sem chamar Gemini quando <= MIN_DECISIONS', async () => {
    const decisions = Array.from({ length: 8 }, (_, i) => makeDecision(i));
    const result = await filterByRelevance(decisions);

    expect(queryGeminiTextMock).not.toHaveBeenCalled();
    expect(result.totalEvaluated).toBe(8);
    expect(result.totalSelected).toBe(8);
    expect(result.selected.every((d) => d.relevanceScore === 70)).toBe(true);
  });

  it('processa múltiplos batches em paralelo (concorrência > 1)', async () => {
    // 35 decisões => 4 batches (BATCH_SIZE=10) — pool de 3 workers.
    const decisions = Array.from({ length: 35 }, (_, i) => makeDecision(i));

    // Cada chamada Gemini "demora" 50ms e registramos início/fim para detectar overlap.
    let inFlight = 0;
    let maxInFlight = 0;
    queryGeminiTextMock.mockImplementation(async (prompt: string) => {
      // Extrai os IDs do prompt para retornar evaluation correta
      const ids = Array.from(prompt.matchAll(/"id":\s*"(dec-\d+)"/g)).map((m) => m[1]);
      const batch = ids.map((id) => ({ id, title: '', description: null, category: 'tribunal-decisions' as const }));
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 50));
      inFlight--;
      return makeBatchResponse(batch);
    });

    const start = Date.now();
    const result = await filterByRelevance(decisions);
    const elapsed = Date.now() - start;

    // 4 batches × 50ms sequencial seria 200ms. Com concorrência 3, esperamos ~100ms.
    expect(elapsed).toBeLessThan(180);
    // Confirma overlap real: pelo menos 2 chamadas concorrentes em algum ponto.
    expect(maxInFlight).toBeGreaterThanOrEqual(2);
    expect(queryGeminiTextMock).toHaveBeenCalledTimes(4);
    expect(result.totalEvaluated).toBe(35);
    // Cap em MAX_DECISIONS = 30
    expect(result.totalSelected).toBeLessThanOrEqual(30);
  });

  it('aplica fallback (score 0) para decisões cujo batch Gemini falhou', async () => {
    // 15 decisões = 2 batches. Primeiro lança erro, segundo OK.
    // Como MIN_DECISIONS=10 e o filtro completa o topo com itens score=0 quando
    // não passa o threshold, esperamos ver fallbacks no resultado final.
    const decisions = Array.from({ length: 15 }, (_, i) => makeDecision(i));

    queryGeminiTextMock
      .mockImplementationOnce(async () => {
        throw new Error('Gemini timeout no primeiro batch');
      })
      .mockImplementationOnce(async (prompt: string) => {
        const ids = Array.from(prompt.matchAll(/"id":\s*"(dec-\d+)"/g)).map((m) => m[1]);
        return makeBatchResponse(ids.map((id) => ({ id, title: '', description: null, category: 'tribunal-decisions' as const })));
      });

    const result = await filterByRelevance(decisions);

    // 5 itens bem-sucedidos (score 75) + completar até MIN=10 com fallback (score 0)
    const failed = result.selected.filter((d) => d.relevanceScore === 0);
    expect(failed.length).toBeGreaterThan(0);
    expect(result.totalSelected).toBe(10);
  });

  it('retorna vazio quando não há decisões', async () => {
    const result = await filterByRelevance([]);
    expect(result.totalEvaluated).toBe(0);
    expect(result.totalSelected).toBe(0);
    expect(result.selected).toEqual([]);
    expect(queryGeminiTextMock).not.toHaveBeenCalled();
  });
});
