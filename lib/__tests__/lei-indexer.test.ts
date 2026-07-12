// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { LeiIndexer } from '../lei-indexer';

const mkResult = (
  articles: Array<{ articleNumber: string; confidence: number }>,
  confidence = 0.5,
) => ({ articles, confidence }) as never;

describe('LeiIndexer.resultToLeiArticles', () => {
  it('ordena por confiança decrescente', () => {
    const r = LeiIndexer.resultToLeiArticles(
      mkResult([
        { articleNumber: '75', confidence: 0.5 },
        { articleNumber: '6', confidence: 0.9 },
      ]),
    );
    expect(r).toEqual(['6', '75']);
  });

  it('desempata numericamente quando a confiança é igual', () => {
    const r = LeiIndexer.resultToLeiArticles(
      mkResult([
        { articleNumber: '75', confidence: 0.8 },
        { articleNumber: '6', confidence: 0.8 },
      ]),
    );
    expect(r).toEqual(['6', '75']);
  });
});

describe('LeiIndexer.getBatchStats', () => {
  it('conta documentos indexados e falhos', () => {
    const stats = LeiIndexer.getBatchStats([
      mkResult([{ articleNumber: '75', confidence: 0.8 }], 0.8),
      mkResult([], 0),
    ]);
    expect(stats.totalDocuments).toBe(2);
    expect(stats.successfullyIndexed).toBe(1);
    expect(stats.failed).toBe(1);
  });

  it('lista os artigos mais frequentes', () => {
    const stats = LeiIndexer.getBatchStats([
      mkResult([{ articleNumber: '75', confidence: 0.9 }], 0.9),
      mkResult([{ articleNumber: '75', confidence: 0.9 }], 0.9),
    ]);
    expect(stats.topArticles[0]).toEqual({ article: '75', count: 2 });
  });
});
