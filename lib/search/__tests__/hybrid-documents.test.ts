// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { SearchResult } from '@/lib/embeddings/vector-search';
import { filterByEnrollment, dedupeByDocument, sortByTypePriority, mapDocumentRowToResult, mapActRowToResult, mergeHybridIntoResults } from '../hybrid-documents';

function sr(over: Partial<SearchResult>): SearchResult {
  return {
    documentId: 'd1', documentTitle: 't', category: 'apostila', chunkContent: 'c',
    chunkIndex: 0, similarity: 0.5, isCommon: false, sourceType: 'document' as const, ...over,
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

describe('mapDocumentRowToResult', () => {
  it('mapeia linha do Document para DocumentResult com courseName resolvido', () => {
    const row = {
      id: 'd1', title: 'Apostila', description: 'desc', category: 'apostila',
      type: 'material', url: null, courseId: '3', tags: '["a"]',
      uploadedAt: new Date('2024-01-01T00:00:00Z'), isPublic: false,
    };
    const out = mapDocumentRowToResult(row);
    expect(out.id).toBe('d1');
    expect(out.description).toBe('desc');
    expect(out.category).toBe('apostila');
    expect(out.type).toBe('material');
    expect(out.courseId).toBe('3');
    expect(out.tags).toBe('["a"]');
    expect(out.uploadedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(out.isPublic).toBe(false);
    expect(typeof out.courseName).toBe('string');
    expect(out.courseName!.length).toBeGreaterThan(0);
  });
});

describe('mapActRowToResult', () => {
  it('mapeia linha do LegislativeAct para LegislativeActResult (leiArticles parseado)', () => {
    const row = {
      id: 'a1', type: 'decreto', fullNumber: 'Decreto 12.000/2024', title: 'T',
      ementa: 'E', summary: null, issuer: 'Presidência',
      publishDate: new Date('2024-02-02T00:00:00Z'), hierarchyLevel: 2,
      leiArticlesArr: ['6', '7'], officialUrl: null, pdfUrl: null,
    };
    const out = mapActRowToResult(row);
    expect(out.id).toBe('a1');
    expect(out.type).toBe('decreto');
    expect(out.fullNumber).toBe('Decreto 12.000/2024');
    expect(out.ementa).toBe('E');
    expect(out.summary).toBeNull();
    expect(out.issuer).toBe('Presidência');
    expect(out.hierarchyLevel).toBe(2);
    expect(out.leiArticles).toEqual(['6', '7']);
    expect(out.publishDate).toBe('2024-02-02T00:00:00.000Z');
  });
});

describe('mergeHybridIntoResults', () => {
  it('substitui só document + legislative-act pelos híbridos, mantém os outros tipos, ordena por prioridade preservando a ordem do híbrido', () => {
    const fts = [
      { type: 'glossary', data: { id: 'g1' } },
      { type: 'document', data: { id: 'ftsDocA' } },
      { type: 'document', data: { id: 'ftsDocB' } },
      { type: 'legislative-act', data: { id: 'ftsAct' } },
      { type: 'lei', data: { numero: '75' } },
    ] as any;
    const hybrid = [
      { type: 'document', data: { id: 'hybDoc1' } },       // relevância 1º
      { type: 'legislative-act', data: { id: 'hybAct1' } },
      { type: 'document', data: { id: 'hybDoc2' } },       // relevância 2º
    ] as any;

    const out = mergeHybridIntoResults(fts, hybrid).map((i: any) => i.data.id ?? i.data.numero);
    // glossary(1), depois documents do HÍBRIDO na ordem hybDoc1, hybDoc2, depois act híbrido, depois lei
    expect(out).toEqual(['g1', 'hybDoc1', 'hybDoc2', 'hybAct1', '75']);
    // nenhum documento/ato do FTS sobrou
    expect(out).not.toContain('ftsDocA');
    expect(out).not.toContain('ftsAct');
  });

  it('híbrido vazio → devolve o FTS ordenado (fallback do merge é neutro)', () => {
    const fts = [{ type: 'document', data: { id: 'ftsDocA' } }] as any;
    const out = mergeHybridIntoResults(fts, []).map((i: any) => i.data.id);
    expect(out).toEqual(['ftsDocA']);
  });
});
