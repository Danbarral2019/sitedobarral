// @vitest-environment node
/**
 * Testes de wizardEnhance (orquestrador): exercita buildLeiInput,
 * buildClaudeEditorialPrompt, callClaudeEditorial e o merge, com LeiIndexer
 * e a camada de IA (generate) mockados. Complementa wizard-enhance.test.ts
 * (funções puras leiIndexerToNumbers/mergeEnhancementResults).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAnalyzeDocument, mockGenerate } = vi.hoisted(() => ({
  mockAnalyzeDocument: vi.fn(),
  mockGenerate: vi.fn(),
}));

vi.mock('@/lib/lei-indexer', () => ({
  LeiIndexer: {
    analyzeDocument: (...a: unknown[]) => mockAnalyzeDocument(...a),
    resultToLeiArticles: (result: { articles?: Array<{ numero: number }> }) =>
      (result?.articles ?? []).map((a) => `Art. ${a.numero}`),
  },
}));
vi.mock('@/lib/ai', () => ({ generate: (...a: unknown[]) => mockGenerate(...a) }));

import { wizardEnhance } from '../wizard-enhance';

const editorialOk = {
  summary: 'Resumo editorial do documento.',
  suggestedImportance: 'alta',
  leiArticles: [75],
  tags: ['licitação'],
  highlights: ['ponto 1'],
  keyPoints: ['tese fixada'],
  confidence: 90,
};

beforeEach(() => {
  mockAnalyzeDocument.mockReset();
  mockGenerate.mockReset();
  mockAnalyzeDocument.mockResolvedValue({ articles: [], primaryArticle: null });
  mockGenerate.mockResolvedValue({ text: JSON.stringify(editorialOk) });
});

describe('wizardEnhance', () => {
  it('combina LeiIndexer + análise editorial da IA num resultado único', async () => {
    const out = await wizardEnhance({
      title: 'Acórdão sobre dispensa', category: 'acordao',
      content: 'trecho editorial', extractedText: 'texto integral do acórdão',
      tags: ['tcu'],
    });
    expect(out.summary).toBe('Resumo editorial do documento.');
    expect(out.suggestedImportance).toBe('alta');
    expect(mockGenerate).toHaveBeenCalledWith('enhancement', expect.objectContaining({ temperature: 0.3 }));
    expect(mockAnalyzeDocument).toHaveBeenCalled();
  });

  it('usa threshold de confiança maior (60) para categorias de parecer', async () => {
    await wizardEnhance({ title: 'Parecer AGU', category: 'parecer', extractedText: 'texto' });
    expect(mockAnalyzeDocument).toHaveBeenCalledWith(expect.anything(), { minConfidence: 60 });
  });

  it('usa threshold 40 para categorias não-parecer', async () => {
    await wizardEnhance({ title: 'Acórdão', category: 'acordao', extractedText: 'texto' });
    expect(mockAnalyzeDocument).toHaveBeenCalledWith(expect.anything(), { minConfidence: 40 });
  });

  it('tolera resposta da IA em cerca markdown (```json)', async () => {
    mockGenerate.mockResolvedValue({ text: '```json\n' + JSON.stringify(editorialOk) + '\n```' });
    const out = await wizardEnhance({ title: 'Doc', category: 'acordao', extractedText: 'x' });
    expect(out.summary).toBe('Resumo editorial do documento.');
  });

  it('não quebra quando a IA editorial falha (mescla só o LeiIndexer)', async () => {
    mockGenerate.mockRejectedValue(new Error('IA indisponível'));
    mockAnalyzeDocument.mockResolvedValue({ articles: [{ numero: 75, confidence: 90 }], primaryArticle: 75 });
    const out = await wizardEnhance({ title: 'Doc', category: 'acordao', extractedText: 'x' });
    // resultado ainda é produzido a partir do LeiIndexer
    expect(out).toBeDefined();
  });
});
