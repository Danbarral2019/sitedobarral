// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTrechos } = vi.hoisted(() => ({ mockTrechos: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { teseTrechoFonte: { findMany: mockTrechos } } }));

import { anexarEvidenciaDasTeses, costurarEvidencia, type TrechoDeTese } from '../evidencia-da-tese';
import type { SearchResult } from '@/lib/embeddings/vector-search';

beforeEach(() => vi.clearAllMocks());

const trecho = (over: Partial<TrechoDeTese> = {}): TrechoDeTese => ({
  enunciadoId: 'e1',
  ordem: 0,
  trecho: 'O relator consignou que a exigência deve guardar pertinência.',
  origemNumero: 100,
  origemAno: 2020,
  noVoto: true,
  origemDocumentId: 'd1',
  origemUrl: null,
  origemLinkPDF: null,
  enunciado: { destilacao: { numeroAlvo: 1441, anoAlvo: 2016, colegiadoAlvo: 'Plenário' } },
  ...over,
});

const resultado = (over: Partial<SearchResult>): SearchResult => ({
  documentId: 'x',
  documentTitle: 'Título',
  category: 'acordao',
  chunkContent: 'conteúdo',
  chunkIndex: 0,
  similarity: 0.8,
  isCommon: true,
  sourceType: 'document',
  ...over,
});

describe('anexarEvidenciaDasTeses', () => {
  it('traz ao menos um trecho por tese recuperada', async () => {
    mockTrechos.mockResolvedValue([trecho()]);
    const r = await anexarEvidenciaDasTeses([resultado({ documentId: 'e1', sourceType: 'tese' })]);
    expect(r.trechos).toHaveLength(1);
    expect(r.documentIdsCitantes).toEqual(['d1']);
    expect(mockTrechos.mock.calls[0][0]).toMatchObject({ where: { enunciadoId: { in: ['e1'] } }, distinct: ['enunciadoId'] });
  });

  it('não consulta nada quando nenhuma tese foi recuperada', async () => {
    const r = await anexarEvidenciaDasTeses([resultado({ documentId: 'd9' })]);
    expect(mockTrechos).not.toHaveBeenCalled();
    expect(r.trechos).toHaveLength(0);
  });

  // A ausência do Document do citante NÃO bloqueia a tese: preservar as 93 é
  // requisito explícito da §9.
  it('mantém a tese quando o citante não existe como Document', async () => {
    mockTrechos.mockResolvedValue([trecho({ origemDocumentId: null, origemUrl: 'https://tcu' })]);
    const r = await anexarEvidenciaDasTeses([resultado({ documentId: 'e1', sourceType: 'tese' })]);
    expect(r.trechos).toHaveLength(1);
    expect(r.documentIdsCitantes).toEqual([]);
  });
});

describe('costurarEvidencia', () => {
  it('põe o trecho do citante no mesmo texto da tese', () => {
    const [tese] = costurarEvidencia(
      [resultado({ documentId: 'e1', sourceType: 'tese', chunkContent: 'Enunciado da tese.' })],
      [trecho()],
    );
    expect(tese.chunkContent).toContain('Enunciado da tese.');
    expect(tese.chunkContent).toContain('Trecho no voto do Acórdão 100/2020');
    expect(tese.chunkContent).toContain('guardar pertinência');
  });

  // Na lista de fontes do chat, a tese se apresenta como síntese e leva à sua
  // própria página, na âncora do enunciado.
  it('dá à tese título de síntese e link para a página do acórdão-líder', () => {
    const [tese] = costurarEvidencia([resultado({ documentId: 'e1', sourceType: 'tese' })], [trecho()]);
    expect(tese.documentTitle).toBe('Tese do TCU sobre o Acórdão 1441/2016');
    expect(tese.url).toBe('/teses/1441-2016-plenario#e1');
  });

  it('tira do contexto a tese que ficou sem trecho', () => {
    const r = costurarEvidencia([resultado({ documentId: 'e1', sourceType: 'tese' })], []);
    expect(r).toEqual([]);
  });

  it('deixa os demais resultados intactos e na mesma ordem', () => {
    const doc = resultado({ documentId: 'd1' });
    const ato = resultado({ documentId: 'a1', sourceType: 'legislative-act' });
    const r = costurarEvidencia([doc, resultado({ documentId: 'e1', sourceType: 'tese' }), ato], [trecho()]);
    expect(r.map((x) => x.documentId)).toEqual(['d1', 'e1', 'a1']);
    expect(r[0]).toBe(doc);
    expect(r[2]).toBe(ato);
  });
});
