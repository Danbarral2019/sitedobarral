// @vitest-environment node
/**
 * Regressão: `GET /api/documents/[id]` não pode vazar campo interno.
 *
 * Bug original (investigação 2026-07-15): a rota fazia `findUnique` sem `select`
 * e espalhava o model inteiro (`...document`) na resposta — mais de 90 colunas,
 * incluindo email de admin (`reviewedBy` em 2.584 documentos), `r2Key`,
 * `extractedText`, raciocínio da IA e mensagens de erro dos pipelines. Ainda
 * mapeava `adminNotes` explicitamente, embora nenhum dos 4 consumidores o use.
 * Não havia nenhuma verificação de auth.
 *
 * A rota é consumida ANONIMAMENTE pela Lei 14.133 Comentada pública, então a
 * correção não pode ser "exigir login" — é devolver só o que as telas usam.
 *
 * Ref.: docs/audits/2026-07-15-lei-comentada-RESULTADOS.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUnique } = vi.hoisted(() => ({ mockFindUnique: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: { document: { findUnique: (...a: unknown[]) => mockFindUnique(...a) } },
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from '../route';
import { NextRequest } from 'next/server';

const req = () => new NextRequest('http://localhost/api/documents/doc-1');
const ctx = { params: Promise.resolve({ id: 'doc-1' }) };

/** Campos que jamais podem sair desta rota. */
const PROIBIDOS = [
  'adminNotes',
  'reviewedBy',
  'notesUpdatedBy',
  'feedbackGivenBy',
  'summaryReviewedBy',
  'feedbackReasoning',
  'feedbackRelevance',
  'aiClassification',
  'aiSuggestedArticles',
  'r2Key',
  'r2MigratedFrom',
  'extractedText',
  'leiIndexerError',
  'embeddingError',
  'tcuEnriquecimentoErro',
];

/** Campos sem os quais alguma tela quebra. */
const NECESSARIOS = [
  'id', 'title', 'description', 'content', 'type', 'url', 'category',
  'courseId', 'tags', 'leiArticlesArr', 'uploadedAt', 'summary',
  'summaryReviewedByAdmin', 'onNumber', 'onYear',
];

describe('GET /api/documents/[id] — campos internos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      id: 'doc-1',
      title: 'ON de teste',
      description: 'desc',
      content: 'texto integral',
      notes: { publicNotes: 'obs do prof', practicalUse: 'uso', keyPoints: 'pontos', importance: 'alta' },
    });
  });

  it('pede select explícito (não traz o model inteiro)', async () => {
    await GET(req(), ctx);
    const arg = mockFindUnique.mock.calls[0][0];
    expect(arg.select).toBeDefined();
    // `include` sem `select` era o que espalhava as ~90 colunas.
    expect(arg.include).toBeUndefined();
  });

  it.each(PROIBIDOS)('não seleciona o campo interno `%s`', async (campo) => {
    await GET(req(), ctx);
    const { select } = mockFindUnique.mock.calls[0][0];
    expect(select[campo]).toBeFalsy();
  });

  it.each(NECESSARIOS)('mantém o campo `%s`, usado pelas telas', async (campo) => {
    await GET(req(), ctx);
    const { select } = mockFindUnique.mock.calls[0][0];
    expect(select[campo]).toBe(true);
  });

  it('não seleciona adminNotes da relação notes', async () => {
    await GET(req(), ctx);
    const { select } = mockFindUnique.mock.calls[0][0];
    expect(select.notes?.select?.adminNotes).toBeFalsy();
    expect(select.notes?.select?.updatedBy).toBeFalsy();
  });

  it('não seleciona o erro de scraper de metaTcu', async () => {
    await GET(req(), ctx);
    const { select } = mockFindUnique.mock.calls[0][0];
    expect(select.metaTcu?.select?.enriquecimentoErro).toBeFalsy();
  });

  it('a resposta não contém adminNotes', async () => {
    const res = await GET(req(), ctx);
    const body = await res.json();
    expect(body).not.toHaveProperty('adminNotes');
  });

  it('preserva os aliases achatados que as telas leem', async () => {
    const res = await GET(req(), ctx);
    const body = await res.json();
    expect(body.publicNotes).toBe('obs do prof');
    expect(body.keyPoints).toBe('pontos');
    expect(body.practicalUse).toBe('uso');
    expect(body.importance).toBe('alta');
  });
});
