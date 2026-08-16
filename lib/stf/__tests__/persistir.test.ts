// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StfDecisaoNormalizada } from '../types';

const { mockFindUnique, mockCreate, mockUpdate, mockClassify, mockSummary } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockClassify: vi.fn(),
  mockSummary: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tribunalDecision: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      create: (...a: unknown[]) => mockCreate(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
  },
}));

vi.mock('@/lib/tribunal-scrapers/classifier', () => ({
  classifyDecision: (...a: unknown[]) => mockClassify(...a),
  generateDecisionSummary: (...a: unknown[]) => mockSummary(...a),
}));

import { persistirDecisoesStf, montarDadosStf, SOURCE_API_STF } from '../persistir';

function decisao(over: Partial<StfDecisaoNormalizada> = {}): StfDecisaoNormalizada {
  return {
    sourceId: 'sjur554999',
    fullIdentifier: 'STF sjur554999',
    decisionType: 'acordao',
    classe: 'ADI',
    decisionNumber: '7764',
    processNumber: '7764',
    year: 2026,
    title: 'ADI 7764',
    ementa: 'Ementa: LICITAÇÃO. Dispensa indevida.',
    ementaTruncada: false,
    relator: 'MINISTRA CÁRMEN LÚCIA',
    orgaoJulgador: 'Tribunal Pleno',
    dataJulgamento: new Date('2026-02-25T00:00:00Z'),
    dataPublicacao: new Date('2026-03-05T00:00:00Z'),
    url: 'https://jurisprudencia.stf.jus.br/pages/search/sjur554999/false',
    uf: 'RR',
    repercussaoGeral: true,
    tema: 'Tema 1234',
    tese: 'É inconstitucional a dispensa genérica.',
    indexacao: null,
    artigos14133: ['75'],
    citaLei14133: true,
    ...over,
  };
}

const CLASSIFICACAO = {
  relevanceScore: 80,
  approvalStatus: 'auto_approved' as const,
  themes: ['licitação'],
  leiArticles: ['37', '75'],
  reasoning: 'menciona dispensa',
  suggestedCourses: '1',
  confidence: 90,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockClassify.mockResolvedValue(CLASSIFICACAO);
  mockSummary.mockResolvedValue('Resumo IA.');
  mockFindUnique.mockResolvedValue(null);
  mockCreate.mockResolvedValue({ id: 'novo' });
  mockUpdate.mockResolvedValue({ id: 'novo' });
});

describe('montarDadosStf', () => {
  it('grava tribunalCode em UPPERCASE', () => {
    expect(montarDadosStf(decisao(), CLASSIFICACAO, null).tribunalCode).toBe('STF');
  });

  it('usa SOMENTE os artigos do campo estruturado do STF, ignorando a heurística do classificador', () => {
    // O classificador devolveu ['37','75'] lendo o texto — o 37 é da Constituição.
    // A fonte autoritativa é o campo de legislação citada, que trouxe só o 75.
    expect(montarDadosStf(decisao(), CLASSIFICACAO, null).leiArticlesArr).toEqual(['75']);
  });

  it('deixa leiArticlesArr vazio quando o julgado não cita a 14.133', () => {
    const d = decisao({ artigos14133: [], citaLei14133: false });
    expect(montarDadosStf(d, CLASSIFICACAO, null).leiArticlesArr).toEqual([]);
  });

  it('guarda classe, UF, tese, tema e truncamento em sourceRawData', () => {
    const raw = JSON.parse(montarDadosStf(decisao(), CLASSIFICACAO, null).sourceRawData!);
    expect(raw).toMatchObject({
      classe: 'ADI',
      uf: 'RR',
      repercussaoGeral: true,
      tema: 'Tema 1234',
      tese: 'É inconstitucional a dispensa genérica.',
      ementaTruncada: false,
    });
  });

  it('identifica a fonte', () => {
    expect(montarDadosStf(decisao(), CLASSIFICACAO, null).sourceApi).toBe(SOURCE_API_STF);
    expect(montarDadosStf(decisao(), CLASSIFICACAO, null).sourceId).toBe('sjur554999');
  });

  it('não define embeddingStatus — deixa o default pending do schema', () => {
    expect('embeddingStatus' in montarDadosStf(decisao(), CLASSIFICACAO, null)).toBe(false);
  });
});

describe('persistirDecisoesStf', () => {
  it('cria decisão inédita', async () => {
    const r = await persistirDecisoesStf([decisao()], {});
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ criados: 1, atualizados: 0, ignorados: 0, erros: 0 });
  });

  it('ignora decisão já existente quando forcar=false', async () => {
    mockFindUnique.mockResolvedValue({ id: 'existente' });
    const r = await persistirDecisoesStf([decisao()], {});
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(r).toMatchObject({ criados: 0, ignorados: 1 });
  });

  it('atualiza decisão existente quando forcar=true', async () => {
    mockFindUnique.mockResolvedValue({ id: 'existente' });
    const r = await persistirDecisoesStf([decisao()], { forcar: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ atualizados: 1, ignorados: 0 });
  });

  it('não escreve nada em dryRun, mas conta o que criaria', async () => {
    const r = await persistirDecisoesStf([decisao()], { dryRun: true });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(r).toMatchObject({ criados: 1 });
  });

  it('só gera resumo IA para decisão auto_approved', async () => {
    mockClassify.mockResolvedValue({ ...CLASSIFICACAO, approvalStatus: 'pending' });
    await persistirDecisoesStf([decisao()], {});
    expect(mockSummary).not.toHaveBeenCalled();
  });

  it('um erro num documento não aborta o lote', async () => {
    mockCreate.mockRejectedValueOnce(new Error('falha de rede'));
    const r = await persistirDecisoesStf([decisao({ sourceId: 'a' }), decisao({ sourceId: 'b' })], {});
    expect(r.erros).toBe(1);
    expect(r.criados).toBe(1);
    expect(r.mensagensErro[0]).toContain('falha de rede');
  });
});
