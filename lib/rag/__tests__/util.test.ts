import { describe, it, expect } from 'vitest';
import { hashQueryStr, diversifyResults, generateExcerpt } from '../util';
import type { SearchResult } from '@/lib/embeddings/vector-search';

/** Fábrica de SearchResult com defaults nos campos obrigatórios. */
function mk(partial: Partial<SearchResult> & { documentId: string; category: string; similarity: number }): SearchResult {
  return {
    documentTitle: `Doc ${partial.documentId}`,
    chunkContent: 'conteúdo',
    chunkIndex: 0,
    isCommon: false,
    sourceType: 'document',
    ...partial,
  };
}

describe('hashQueryStr', () => {
  it('é determinístico para a mesma entrada', () => {
    expect(hashQueryStr('licitação dispensa')).toBe(hashQueryStr('licitação dispensa'));
  });

  it('produz hashes diferentes para entradas diferentes', () => {
    expect(hashQueryStr('pregão')).not.toBe(hashQueryStr('concorrência'));
  });

  it('retorna string base36 (sem sinal)', () => {
    expect(hashQueryStr('qualquer coisa')).toMatch(/^[0-9a-z]+$/);
  });

  it('lida com string vazia', () => {
    expect(hashQueryStr('')).toBe('0');
  });
});

describe('generateExcerpt', () => {
  it('retorna o conteúdo inteiro quando menor que o limite', () => {
    expect(generateExcerpt('texto curto', 200)).toBe('texto curto');
  });

  it('corta no último ponto final quando ele está após 70% do limite', () => {
    const content = 'a'.repeat(150) + '. ' + 'b'.repeat(100);
    const out = generateExcerpt(content, 200);
    expect(out.endsWith('.')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(200);
  });

  it('adiciona reticências quando não há ponto final adequado', () => {
    const content = 'x'.repeat(300);
    expect(generateExcerpt(content, 200)).toBe('x'.repeat(200) + '...');
  });
});

describe('diversifyResults', () => {
  it('retorna todos quando há menos que maxResults', () => {
    const results = [mk({ documentId: '1', category: 'acordao', similarity: 0.9 })];
    expect(diversifyResults(results, 5)).toHaveLength(1);
  });

  it('nunca excede maxResults', () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      mk({ documentId: String(i), category: 'acordao', similarity: 0.9 - i * 0.01 })
    );
    // Categoria homogênea: por design, o cap por categoria (DEFAULT_CAP=3, +1 na
    // Fase 3 = 4) faz o resultado ficar ABAIXO de maxResults. O invariante é ≤.
    expect(diversifyResults(results, 5).length).toBeLessThanOrEqual(5);
  });

  it('atinge maxResults quando há categorias diversas suficientes', () => {
    const results = [
      mk({ documentId: 'ap1', category: 'apostila', similarity: 0.9 }),
      mk({ documentId: 'en1', category: 'enunciados', similarity: 0.85 }),
      mk({ documentId: 'ac1', category: 'acordao', similarity: 0.8 }),
      mk({ documentId: 'de1', category: 'decor', similarity: 0.75 }),
      mk({ documentId: 'in1', category: 'informativo', similarity: 0.7 }),
      mk({ documentId: 'ac2', category: 'acordao', similarity: 0.65 }),
    ];
    expect(diversifyResults(results, 5)).toHaveLength(5);
  });

  it('prioriza tiers mais altos (materiais do curso antes de acórdãos)', () => {
    const results = [
      mk({ documentId: 'ac1', category: 'acordao', similarity: 0.99 }),
      mk({ documentId: 'ac2', category: 'acordao', similarity: 0.98 }),
      mk({ documentId: 'ap1', category: 'apostila', similarity: 0.50 }),
    ];
    const out = diversifyResults(results, 2);
    const ids = out.map((r) => r.documentId);
    // apostila (tier 1) deve entrar mesmo com similaridade menor
    expect(ids).toContain('ap1');
  });

  it('respeita o cap de manual-tcu (1) quando há preenchimento suficiente sem a Fase 3', () => {
    // Com categorias diversas suficientes para atingir maxResults sem relaxar
    // caps (Fase 3 não dispara), manual-tcu fica limitado a 1.
    const results = [
      mk({ documentId: 'm1', category: 'manual-tcu', similarity: 0.99 }),
      mk({ documentId: 'm2', category: 'manual-tcu', similarity: 0.98 }),
      mk({ documentId: 'm3', category: 'manual-tcu', similarity: 0.97 }),
      mk({ documentId: 'e1', category: 'enunciados', similarity: 0.85 }),
      mk({ documentId: 'e2', category: 'enunciados', similarity: 0.84 }),
      mk({ documentId: 'e3', category: 'enunciados', similarity: 0.83 }),
      mk({ documentId: 'a1', category: 'acordao', similarity: 0.70 }),
    ];
    const out = diversifyResults(results, 4);
    const manualCount = out.filter((r) => r.category === 'manual-tcu').length;
    expect(manualCount).toBe(1);
  });

  it('relaxa o cap em +1 na Fase 3 quando não há outras fontes para preencher', () => {
    // Documenta o comportamento real: sem diversidade, a Fase 3 relaxa o cap
    // de manual-tcu de 1 para 2 para tentar preencher maxResults.
    const results = [
      mk({ documentId: 'm1', category: 'manual-tcu', similarity: 0.99 }),
      mk({ documentId: 'm2', category: 'manual-tcu', similarity: 0.98 }),
      mk({ documentId: 'm3', category: 'manual-tcu', similarity: 0.97 }),
      mk({ documentId: 'e1', category: 'enunciados', similarity: 0.60 }),
      mk({ documentId: 'e2', category: 'enunciados', similarity: 0.59 }),
    ];
    const out = diversifyResults(results, 4);
    const manualCount = out.filter((r) => r.category === 'manual-tcu').length;
    expect(manualCount).toBe(2);
  });

  it('interrompe a Fase 1 quando há mais categorias que maxResults', () => {
    // 6 categorias distintas, maxResults 4: a Fase 1 preenche 4 e sai pelo break.
    const results = [
      mk({ documentId: 'ap1', category: 'apostila', similarity: 0.9 }),
      mk({ documentId: 'en1', category: 'enunciados', similarity: 0.85 }),
      mk({ documentId: 'su1', category: 'sumula', similarity: 0.84 }),
      mk({ documentId: 'ac1', category: 'acordao', similarity: 0.8 }),
      mk({ documentId: 'de1', category: 'decor', similarity: 0.75 }),
      mk({ documentId: 'in1', category: 'informativo', similarity: 0.7 }),
    ];
    const out = diversifyResults(results, 4);
    expect(out).toHaveLength(4);
    // Sem repetição de categoria (uma de cada, priorizando tiers altos)
    expect(new Set(out.map((r) => r.category)).size).toBe(4);
  });

  it('trata categoria desconhecida com o tier default (5, menor prioridade)', () => {
    const results = [
      mk({ documentId: 'x1', category: 'categoria-inexistente', similarity: 0.99 }),
      mk({ documentId: 'ap1', category: 'apostila', similarity: 0.5 }),
      mk({ documentId: 'x2', category: 'categoria-inexistente', similarity: 0.98 }),
    ];
    const out = diversifyResults(results, 2);
    // apostila (tier 1) tem prioridade sobre a desconhecida (tier 5), apesar da
    // similaridade menor.
    expect(out.map((r) => r.documentId)).toContain('ap1');
  });

  it('não repete documentos', () => {
    const results = Array.from({ length: 8 }, (_, i) =>
      mk({ documentId: String(i), category: i % 2 === 0 ? 'acordao' : 'enunciados', similarity: 0.9 - i * 0.01 })
    );
    const out = diversifyResults(results, 6);
    const ids = out.map((r) => r.documentId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
