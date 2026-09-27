import { describe, it, expect } from 'vitest';
import {
  selecionarPendentes,
  decidirItemDoFeed,
  montarDocumentoAlvo,
  feedPassouDoAno,
  MARCA_ALVOS_CITADOS,
  type ItemFeedComKey,
} from './alvos-citados';
import { CATEGORIA_GRAFO } from './backfill-retroativo';
import type { CandidatoAcordao } from './buscar-acordao-tcu';

const cand = (over: Partial<CandidatoAcordao> = {}): CandidatoAcordao => ({
  numero: 1233,
  ano: 2012,
  colegiado: 'Plenário',
  relator: 'FULANO',
  ementa: 'Ementa.',
  key: 'ACORDAO-COMPLETO-100',
  link: 'https://pesquisa.apps.tcu.gov.br/documento/acordao-completo-100',
  isRelacao: false,
  ...over,
});

const item = (over: Partial<ItemFeedComKey> = {}): ItemFeedComKey => ({
  key: 'ACORDAO-COMPLETO-100',
  tipo: 'ACÓRDÃO',
  numeroAcordao: '1233',
  anoAcordao: '2012',
  titulo: 'ACÓRDÃO 1233/2012 ATA 18/2012 - PLENÁRIO',
  sumario: 'Ementa do feed.',
  colegiado: 'Plenário',
  relator: 'FULANO',
  dataSessao: '16/05/2012',
  urlArquivo: 'https://contas.tcu.gov.br/sagas/SvlVisualizarRelVotoAcRtf?item0=1',
  ...over,
});

describe('selecionarPendentes', () => {
  const alvos = [
    { numero: 1, ano: 2010, no_voto: 3 },
    { numero: 2, ano: 2011, no_voto: 9 },
    { numero: 3, ano: 2012, no_voto: 5 },
    { numero: 4, ano: 2013, no_voto: 2 },
    { numero: 5, ano: 2014, no_voto: 7 },
  ];

  it('ordena pelos mais citados no voto, primeiro', () => {
    const r = selecionarPendentes(alvos, { documentos: new Set(), teses: new Set(), irresolvidos: new Set() });
    expect(r.map((a) => a.chave)).toEqual(['2/2011', '5/2014', '3/2012', '1/2010', '4/2013']);
  });

  it('exclui quem já é Document, quem já tem tese atual e quem já foi dado como irresolvido', () => {
    const r = selecionarPendentes(alvos, {
      documentos: new Set(['2/2011']),
      teses: new Set(['5/2014']),
      irresolvidos: new Set(['3/2012']),
    });
    expect(r.map((a) => a.chave)).toEqual(['1/2010', '4/2013']);
  });
});

describe('decidirItemDoFeed', () => {
  it('ingere quando a identidade oficial é única e a KEY bate com a do item', () => {
    expect(decidirItemDoFeed({ item: item(), candidatos: [cand()], convergencia: null })).toEqual({
      tipo: 'ingerir',
      origem: 'identidade',
    });
  });

  it('ignora (sem registrar) a variante cuja KEY não é a do acórdão resolvido', () => {
    const d = decidirItemDoFeed({ item: item({ key: 'ACORDAO-COMPLETO-999' }), candidatos: [cand()], convergencia: null });
    expect(d.tipo).toBe('ignorar');
  });

  it('ignora acórdão de relação do feed, mesmo com identidade resolvida', () => {
    const d = decidirItemDoFeed({ item: item({ tipo: 'ACÓRDÃO DE RELAÇÃO' }), candidatos: [cand()], convergencia: null });
    expect(d.tipo).toBe('ignorar');
  });

  it('prefere o acórdão completo ao de relação na identidade oficial', () => {
    const cands = [cand(), cand({ key: 'ACORDAO-COMPLETO-200', isRelacao: true })];
    expect(decidirItemDoFeed({ item: item(), candidatos: cands, convergencia: null }).tipo).toBe('ingerir');
  });

  it('não encontrado quando o TCU não devolve acórdão completo para o número', () => {
    const d = decidirItemDoFeed({ item: item(), candidatos: [cand({ isRelacao: true })], convergencia: null });
    expect(d).toEqual({ tipo: 'naoEncontrado' });
  });

  describe('mesmo número em mais de um colegiado', () => {
    const cands = [
      cand(),
      cand({ key: 'ACORDAO-COMPLETO-300', colegiado: 'Primeira Câmara' }),
    ];

    it('sem convergência dos citantes: ambíguo, não ingere', () => {
      expect(decidirItemDoFeed({ item: item(), candidatos: cands, convergencia: null })).toEqual({
        tipo: 'ambiguo',
        candidatos: 2,
      });
    });

    it('com convergência unânime no colegiado do item: ingere por convergência', () => {
      expect(decidirItemDoFeed({ item: item(), candidatos: cands, convergencia: 'Plenário' })).toEqual({
        tipo: 'ingerir',
        origem: 'convergencia',
      });
    });

    it('com convergência em outro colegiado: ignora este item e espera o certo', () => {
      const d = decidirItemDoFeed({ item: item(), candidatos: cands, convergencia: 'Primeira Câmara' });
      expect(d.tipo).toBe('ignorar');
    });

    it('convergência que aponta para dois candidatos do mesmo colegiado continua ambígua', () => {
      const dois = [cand(), cand({ key: 'ACORDAO-COMPLETO-400' }), cand({ key: 'ACORDAO-COMPLETO-300', colegiado: 'Primeira Câmara' })];
      expect(decidirItemDoFeed({ item: item(), candidatos: dois, convergencia: 'Plenário' }).tipo).toBe('ambiguo');
    });

    it('convergência para colegiado sem candidato: ambíguo', () => {
      expect(decidirItemDoFeed({ item: item(), candidatos: cands, convergencia: 'Segunda Câmara' }).tipo).toBe('ambiguo');
    });
  });

  it('item do feed sem KEY: casa pelo colegiado do candidato único', () => {
    expect(decidirItemDoFeed({ item: item({ key: undefined }), candidatos: [cand()], convergencia: null }).tipo).toBe('ingerir');
    expect(
      decidirItemDoFeed({ item: item({ key: undefined, colegiado: 'Segunda Câmara' }), candidatos: [cand()], convergencia: null }).tipo
    ).toBe('ignorar');
  });
});

describe('montarDocumentoAlvo', () => {
  it('entra invisível, fora da fila de embeddings e com marca própria', () => {
    const d = montarDocumentoAlvo(item())!;
    expect(d.category).toBe(CATEGORIA_GRAFO);
    expect(d.isPublic).toBe(false);
    expect(d.isCommon).toBe(false);
    expect(d.reviewedBy).toBe(MARCA_ALVOS_CITADOS);
    expect(d.embeddingStatus).toBe('skipped');
    expect(d.tcuLinkPDF).toContain('SvlVisualizarRelVotoAcRtf');
    expect(d.acordaoNumero).toBe(1233);
    expect(d.acordaoAno).toBe(2012);
    expect(d.tcuOrgaoJulgador).toBe('Plenário');
  });

  it('não monta acórdão de relação', () => {
    expect(montarDocumentoAlvo(item({ tipo: 'ACÓRDÃO DE RELAÇÃO' }))).toBeNull();
  });
});

describe('feedPassouDoAno', () => {
  it('só é verdadeiro quando TODOS os itens datados estão abaixo do ano mínimo', () => {
    // O feed profundo devolve páginas com datas misturadas (medido em 27/09/2026):
    // um único item acima do mínimo basta para não encerrar.
    expect(feedPassouDoAno([item({ dataSessao: '10/10/1992' }), item({ dataSessao: '01/01/1991' })], 1993)).toBe(true);
    expect(feedPassouDoAno([item({ dataSessao: '10/10/1992' }), item({ dataSessao: '09/07/2024' })], 1993)).toBe(false);
  });

  it('página vazia ou sem datas não encerra (sinal ambíguo)', () => {
    expect(feedPassouDoAno([], 1993)).toBe(false);
    expect(feedPassouDoAno([item({ dataSessao: undefined })], 1993)).toBe(false);
  });
});
