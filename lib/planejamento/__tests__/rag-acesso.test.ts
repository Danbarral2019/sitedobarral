// @vitest-environment node
/**
 * Planejamento filtra os trechos de Document pela regra única de acesso
 * (lib/search/acesso-documentos): no SQL da busca vetorial e de novo no
 * resultado, antes do rerank e do prompt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchResult } from '@/lib/embeddings/vector-search';
import type { AcessoDoUsuario } from '@/lib/search/acesso-documentos';

const mocks = vi.hoisted(() => ({
  semanticSearch: vi.fn(),
  rerankResults: vi.fn(),
  generate: vi.fn(),
}));

vi.mock('@/lib/embeddings/vector-search', () => ({
  semanticSearch: (...a: unknown[]) => mocks.semanticSearch(...a),
}));
vi.mock('@/lib/embeddings/reranker', () => ({
  rerankResults: (...a: unknown[]) => mocks.rerankResults(...a),
}));
vi.mock('@/lib/legal-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/legal-context')>()),
  selectRelevantArticles: async () => [],
  findRelatedActs: async () => [],
}));
vi.mock('@/lib/ai', () => ({
  generate: (...a: unknown[]) => mocks.generate(...a),
}));

import { buildSectionContext } from '../rag';
import { generateSectionText } from '../section-generator';
import { getTrailBySlug } from '@/data/planejamento/trails';

const def = getTrailBySlug('servico-comum-continuado-etp')!.sections[0];

function hit(p: Partial<SearchResult> & { documentId: string }): SearchResult {
  return {
    documentTitle: `Título ${p.documentId}`,
    category: 'apostila',
    chunkContent: `conteúdo de ${p.documentId}`,
    chunkIndex: 0,
    similarity: 0.8,
    isCommon: false,
    sourceType: 'document',
    ...p,
  };
}

const PUBLICO = hit({ documentId: 'pub', isPublic: true });
const CURSO_2 = hit({ documentId: 'curso2', isPublic: false, courseId: '2' });
const CURSO_3 = hit({ documentId: 'curso3', isPublic: false, courseId: '3' });
const ATO = hit({ documentId: 'ato', sourceType: 'legislative-act', isCommon: false });

const ALUNO_CURSO_2: AcessoDoUsuario = { isAdmin: false, temAcessoAtivo: true, cursosAtivos: ['2'] };
const ADMIN: AcessoDoUsuario = { isAdmin: true, temAcessoAtivo: true, cursosAtivos: ['2', '3'] };

describe('planejamento: RAG filtrado pelo acesso do usuário', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // A busca "vaza" um documento de outro curso: o pós-filtro tem de barrá-lo
    mocks.semanticSearch.mockResolvedValue({ results: [PUBLICO, CURSO_2, CURSO_3, ATO], query: 'q', totalFound: 4 });
    mocks.rerankResults.mockImplementation(async (_q: string, hits: SearchResult[], limit: number) => hits.slice(0, limit));
    mocks.generate.mockResolvedValue({ text: 'texto', provider: 'anthropic', modelId: 'm', inputTokens: 1, outputTokens: 1 });
  });

  it('manda a regra de acesso no SQL do ramo Document', async () => {
    await buildSectionContext(def, { acesso: ALUNO_CURSO_2, descricaoLivre: 'contratação de limpeza predial' });

    const opts = mocks.semanticSearch.mock.calls[0][1];
    const sql: string = opts.extraWhere.document.sql;
    expect(sql).toContain('d."isPublic" = true');
    expect(sql).toContain(`d."courseId" IN ('2')`);
    expect(sql).not.toContain(`'3'`);
    expect(sql).toContain('d.category <>');
  });

  it('descarta trecho de curso sem acesso antes do rerank, das fontes e dos excertos', async () => {
    const ctx = await buildSectionContext(def, { acesso: ALUNO_CURSO_2, descricaoLivre: 'contratação de limpeza predial' });

    const enviados = (mocks.rerankResults.mock.calls[0][1] as SearchResult[]).map((r) => r.documentId);
    expect(enviados).not.toContain('curso3');
    expect(enviados).toEqual(expect.arrayContaining(['pub', 'curso2']));
    expect(ctx.ragHits.map((r) => r.documentId)).not.toContain('curso3');
    expect(ctx.excerpts.some((e) => e.id.includes('curso3'))).toBe(false);
    expect(ctx.sources.some((s) => s.id.includes('curso3'))).toBe(false);
    expect(ctx.layeredContext).not.toContain('conteúdo de curso3');
  });

  it('visitante sem acesso ativo só recebe documento público', async () => {
    const semAcesso: AcessoDoUsuario = { isAdmin: false, temAcessoAtivo: false, cursosAtivos: [] };
    const ctx = await buildSectionContext(def, { acesso: semAcesso, descricaoLivre: 'contratação de limpeza predial' });
    const docs = ctx.ragHits.filter((r) => r.sourceType === 'document').map((r) => r.documentId);
    expect(docs).toEqual(['pub']);
  });

  it('admin vê tudo (SQL sem restrição)', async () => {
    const ctx = await buildSectionContext(def, { acesso: ADMIN, descricaoLivre: 'contratação de limpeza predial' });
    expect(mocks.semanticSearch.mock.calls[0][1].extraWhere.document.sql).toBe('TRUE');
    expect(ctx.ragHits.map((r) => r.documentId)).toEqual(expect.arrayContaining(['pub', 'curso2', 'curso3']));
  });

  it('section-generator repassa o acesso e o prompt não leva trecho sem acesso', async () => {
    await generateSectionText({
      def,
      acesso: ALUNO_CURSO_2,
      descricaoLivre: 'contratação de limpeza predial',
      mode: 'fresh',
    });

    expect(mocks.semanticSearch.mock.calls[0][1].extraWhere.document.sql).toContain(`('2')`);
    const prompt: string = mocks.generate.mock.calls[0][1].messages[0].content;
    expect(prompt).not.toContain('conteúdo de curso3');
    expect(prompt).toContain('conteúdo de curso2');
  });
});
