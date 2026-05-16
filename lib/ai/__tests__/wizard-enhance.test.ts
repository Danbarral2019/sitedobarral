import { describe, it, expect } from 'vitest';
import {
  mergeEnhancementResults,
  leiIndexerToNumbers,
  type WizardEnhanceOutput,
} from '../wizard-enhance';
import type { ArticleAnalysisResult } from '@/lib/lei-indexer';

const claudeOk = (overrides: Partial<{ leiArticles: number[]; suggestedImportance: 'baixa' | 'media' | 'alta' | 'critica' }> = {}) => ({
  status: 'fulfilled' as const,
  value: {
    summary: 'Resumo gerado',
    highlights: ['H1', 'H2'],
    keyPoints: ['K1'],
    practicalUse: 'Uso prático',
    publicNotes: 'Observação',
    suggestedImportance: 'media' as const,
    tags: ['t1', 't2'],
    leiArticles: [],
    confidence: 80,
    reasoning: 'Razão Claude',
    ...overrides,
  },
});

const leiOk = (articles: Array<{ articleNumber: string; confidence: number; reasoning: string; mentions: number }>, conf = 70): PromiseFulfilledResult<ArticleAnalysisResult> => ({
  status: 'fulfilled',
  value: {
    documentId: 'doc-1',
    articles,
    autoIndexed: true,
    analyzedAt: new Date(),
    confidence: conf,
    reasoning: 'Razão LeiIndexer',
  },
});

const reject = (reason: string): PromiseRejectedResult => ({ status: 'rejected', reason: new Error(reason) });

describe('leiIndexerToNumbers', () => {
  it('converte numbers simples', () => {
    expect(leiIndexerToNumbers(['5', '75', '194'])).toEqual([5, 75, 194]);
  });

  it('extrai dígitos de articles com letra (ex: 184-A)', () => {
    expect(leiIndexerToNumbers(['184-A', '6'])).toEqual([184, 6]);
  });

  it('filtra fora do range 1-194', () => {
    expect(leiIndexerToNumbers(['0', '195', '500', '50'])).toEqual([50]);
  });

  it('descarta NaN', () => {
    expect(leiIndexerToNumbers(['abc', '', '12'])).toEqual([12]);
  });
});

describe('mergeEnhancementResults', () => {
  it('LeiIndexer com artigos vence: leiArticles vêm dele, editorial vem do Claude', () => {
    const lei = leiOk([
      { articleNumber: '75', confidence: 90, reasoning: 'r', mentions: 2 },
      { articleNumber: '18', confidence: 80, reasoning: 'r', mentions: 1 },
    ], 85);
    const claude = claudeOk({ leiArticles: [999] }); // Claude alucinou — deve ser ignorado

    const out = mergeEnhancementResults(lei, claude);

    expect(out.leiArticles).toEqual([75, 18]);
    expect(out.confidence).toBe(85);
    expect(out._meta.mergeStrategy).toBe('lei-indexer');
    expect(out._meta.claudeArticles).toEqual([999]); // registrado para diagnóstico mas ignorado
    expect(out._meta.leiIndexerArticles).toEqual(['75', '18']);
    // Editorial preservado do Claude
    expect(out.summary).toBe('Resumo gerado');
    expect(out.suggestedImportance).toBe('media');
    expect(out.tags).toEqual(['t1', 't2']);
  });

  it('LeiIndexer OK mas vazio: respeita decisão, leiArticles = []', () => {
    const lei = leiOk([], 0);
    const claude = claudeOk({ leiArticles: [5, 6] }); // mesmo se Claude sugerir, ignora

    const out = mergeEnhancementResults(lei, claude);

    expect(out.leiArticles).toEqual([]);
    expect(out._meta.mergeStrategy).toBe('lei-indexer-empty');
    expect(out.summary).toBe('Resumo gerado');
  });

  it('LeiIndexer falha e Claude tem artigos: fallback para Claude', () => {
    const lei = reject('Gemini timeout');
    const claude = claudeOk({ leiArticles: [22, 23] });

    const out = mergeEnhancementResults(lei, claude);

    expect(out.leiArticles).toEqual([22, 23]);
    expect(out._meta.mergeStrategy).toBe('fallback-claude');
    expect(out._meta.leiIndexerSucceeded).toBe(false);
    expect(out._meta.claudeSucceeded).toBe(true);
    expect(out.reasoning).toContain('fallback');
  });

  it('LeiIndexer falha e Claude também sem artigos: leiArticles = []', () => {
    const lei = reject('error');
    const claude = claudeOk({ leiArticles: [] });

    const out = mergeEnhancementResults(lei, claude);

    expect(out.leiArticles).toEqual([]);
    expect(out._meta.mergeStrategy).toBe('all-failed');
  });

  it('ambos falham: retorna placeholder vazio com strategy all-failed', () => {
    const lei = reject('a');
    const claude = reject('b');

    const out = mergeEnhancementResults(lei, claude);

    expect(out.leiArticles).toEqual([]);
    expect(out.summary).toBe('');
    expect(out._meta.mergeStrategy).toBe('all-failed');
    expect(out._meta.leiIndexerSucceeded).toBe(false);
    expect(out._meta.claudeSucceeded).toBe(false);
  });

  it('LeiIndexer OK + Claude falha: editorial fica vazio, leiArticles preservados', () => {
    const lei = leiOk([{ articleNumber: '5', confidence: 90, reasoning: 'r', mentions: 1 }]);
    const claude = reject('claude error');

    const out = mergeEnhancementResults(lei, claude);

    expect(out.leiArticles).toEqual([5]);
    expect(out.summary).toBe('');
    expect(out.highlights).toEqual([]);
    expect(out._meta.mergeStrategy).toBe('lei-indexer');
  });

  it('mantém o shape esperado pela UI (todos os campos top-level)', () => {
    const lei = leiOk([]);
    const claude = claudeOk();
    const out: WizardEnhanceOutput = mergeEnhancementResults(lei, claude);

    // Campos que Step2LeiArticles.tsx + types.ts:64-75 esperam
    expect(out).toHaveProperty('summary');
    expect(out).toHaveProperty('highlights');
    expect(out).toHaveProperty('keyPoints');
    expect(out).toHaveProperty('practicalUse');
    expect(out).toHaveProperty('publicNotes');
    expect(out).toHaveProperty('suggestedImportance');
    expect(out).toHaveProperty('tags');
    expect(out).toHaveProperty('leiArticles');
    expect(out).toHaveProperty('confidence');
    expect(out).toHaveProperty('reasoning');
  });
});
