// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { filterByEnrollment, dedupeByDocument, sortByTypePriority } from '../hybrid-documents';

function sr(over: Partial<import('@/lib/embeddings/vector-search').SearchResult>) {
  return {
    documentId: 'd1', documentTitle: 't', category: 'apostila', chunkContent: 'c',
    similarity: 0.5, isCommon: false, sourceType: 'document' as const, ...over,
  };
}

describe('filterByEnrollment', () => {
  it('mantém isCommon, sem-curso e curso matriculado; remove curso não-matriculado', () => {
    const results = [
      sr({ documentId: 'a', isCommon: true, courseId: 'x' }),   // comum → mantém
      sr({ documentId: 'b', isCommon: false, courseId: undefined }), // sem curso → mantém
      sr({ documentId: 'c', isCommon: false, courseId: '3' }),  // matriculado → mantém
      sr({ documentId: 'd', isCommon: false, courseId: '99' }), // NÃO matriculado → remove
    ];
    const kept = filterByEnrollment(results, ['3', '10']).map(r => r.documentId);
    expect(kept).toEqual(['a', 'b', 'c']);
  });
});

describe('dedupeByDocument', () => {
  it('mantém 1 por documentId, com a maior similarity, preservando a ordem de 1ª aparição', () => {
    const results = [
      sr({ documentId: 'a', similarity: 0.9 }),
      sr({ documentId: 'b', similarity: 0.8 }),
      sr({ documentId: 'a', similarity: 0.95 }), // duplicado de 'a', maior score
    ];
    const out = dedupeByDocument(results);
    expect(out.map(r => r.documentId)).toEqual(['a', 'b']);
    expect(out[0].similarity).toBe(0.95);
  });
});

describe('sortByTypePriority', () => {
  it('ordena por prioridade de tipo e preserva a ordem interna (estável)', () => {
    const items = [
      { type: 'document', data: { id: 'doc2' } },
      { type: 'glossary', data: { id: 'g1' } },
      { type: 'document', data: { id: 'doc1' } },
      { type: 'legislative-act', data: { id: 'act1' } },
    ] as any;
    const out = sortByTypePriority(items).map((i: any) => i.data.id);
    // glossary(1) < document(3) < legislative-act(4); docs mantêm ordem doc2, doc1
    expect(out).toEqual(['g1', 'doc2', 'doc1', 'act1']);
  });
});
