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

import {
  persistirDecisoesStf,
  montarDadosStf,
  aplicarAmarracaoAutoritativa,
  SOURCE_API_STF,
} from '../persistir';

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
    legislacaoCitada: null,
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

describe('aplicarAmarracaoAutoritativa', () => {
  it('aprova automaticamente um julgado pending que amarra artigo da 14.133', () => {
    const d = decisao({ artigos14133: ['75'] });
    const resultado = aplicarAmarracaoAutoritativa(d, { ...CLASSIFICACAO, approvalStatus: 'pending' });
    expect(resultado.approvalStatus).toBe('auto_approved');
  });

  it('aprova automaticamente um julgado auto_rejected que amarra artigo da 14.133', () => {
    const d = decisao({ artigos14133: ['75'] });
    const resultado = aplicarAmarracaoAutoritativa(d, { ...CLASSIFICACAO, approvalStatus: 'auto_rejected' });
    expect(resultado.approvalStatus).toBe('auto_approved');
  });

  it('não altera nada quando o julgado não amarra nenhum artigo da 14.133', () => {
    const d = decisao({ artigos14133: [] });
    const classification = { ...CLASSIFICACAO, approvalStatus: 'pending' as const };
    const resultado = aplicarAmarracaoAutoritativa(d, classification);
    expect(resultado).toEqual(classification);
  });

  it('registra no reasoning que a aprovação veio da amarração à norma, citando os artigos', () => {
    const d = decisao({ artigos14133: ['75', '90'] });
    const resultado = aplicarAmarracaoAutoritativa(d, { ...CLASSIFICACAO, approvalStatus: 'pending' });
    expect(resultado.reasoning).toContain('75, 90');
  });

  it('preserva relevanceScore, themes e confidence do classificador quando a regra dispara', () => {
    const d = decisao({ artigos14133: ['75'] });
    const classification = { ...CLASSIFICACAO, approvalStatus: 'pending' as const, relevanceScore: 12, themes: ['x'], confidence: 33 };
    const resultado = aplicarAmarracaoAutoritativa(d, classification);
    expect(resultado.relevanceScore).toBe(12);
    expect(resultado.themes).toEqual(['x']);
    expect(resultado.confidence).toBe(33);
    expect(resultado.suggestedCourses).toBe(classification.suggestedCourses);
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

  it('dryRun não classifica nem resume — decide só por `existente`, e ainda conta o que criaria', async () => {
    const r = await persistirDecisoesStf([decisao()], { dryRun: true });
    expect(mockClassify).not.toHaveBeenCalled();
    expect(mockSummary).not.toHaveBeenCalled();
    expect(r).toMatchObject({ criados: 1 });
  });

  it('só gera resumo IA para decisão auto_approved', async () => {
    mockClassify.mockResolvedValue({ ...CLASSIFICACAO, approvalStatus: 'pending' });
    // Sem amarração à norma, para isolar do overlay de aplicarAmarracaoAutoritativa
    // (testado separadamente) — aqui o que se testa é o gate por approvalStatus puro.
    await persistirDecisoesStf([decisao({ artigos14133: [] })], {});
    expect(mockSummary).not.toHaveBeenCalled();
  });

  it('amarração à norma vira auto_approved já a tempo de gerar resumo IA (ordem: overlay antes da decisão de resumir)', async () => {
    mockClassify.mockResolvedValue({ ...CLASSIFICACAO, approvalStatus: 'pending' });
    const d = decisao({ artigos14133: ['75'] });
    await persistirDecisoesStf([d], {});
    expect(mockSummary).toHaveBeenCalledTimes(1);
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.approvalStatus).toBe('auto_approved');
    expect(data.isRelevant).toBe(true);
  });

  it('um erro num documento não aborta o lote', async () => {
    mockCreate.mockRejectedValueOnce(new Error('falha de rede'));
    const r = await persistirDecisoesStf([decisao({ sourceId: 'a' }), decisao({ sourceId: 'b' })], {});
    expect(r.erros).toBe(1);
    expect(r.criados).toBe(1);
    expect(r.mensagensErro[0]).toContain('falha de rede');
  });
});

describe('persistirDecisoesStf — preserva julgamento humano em update', () => {
  it('reviewedBy não nulo: update omite approvalStatus e isRelevant, mas mantém o resto do conteúdo', async () => {
    mockFindUnique.mockResolvedValue({ id: 'existente', reviewedBy: 'admin@x.com', summary: 'resumo antigo' });
    await persistirDecisoesStf([decisao()], { forcar: true });
    const data = mockUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('approvalStatus');
    expect(data).not.toHaveProperty('isRelevant');
    // não virou no-op: o conteúdo do julgado continua sendo refrescado
    expect(data).toHaveProperty('ementa');
    expect(data).toHaveProperty('leiArticlesArr');
  });

  it('reviewedBy nulo: update grava approvalStatus e isRelevant normalmente', async () => {
    mockFindUnique.mockResolvedValue({ id: 'existente', reviewedBy: null, summary: null });
    await persistirDecisoesStf([decisao()], { forcar: true });
    const data = mockUpdate.mock.calls[0][0].data;
    expect(data).toHaveProperty('approvalStatus', CLASSIFICACAO.approvalStatus);
    expect(data).toHaveProperty('isRelevant');
  });

  it('classificação que não é auto_approved (summary calculado null): update não sobrescreve resumo existente', async () => {
    mockFindUnique.mockResolvedValue({ id: 'existente', reviewedBy: null, summary: 'resumo antigo' });
    mockClassify.mockResolvedValue({ ...CLASSIFICACAO, approvalStatus: 'pending' });
    // Sem amarração à norma — senão o overlay de aplicarAmarracaoAutoritativa
    // forçaria auto_approved e o resumo deixaria de ser null.
    await persistirDecisoesStf([decisao({ artigos14133: [] })], { forcar: true });
    const data = mockUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('summary');
  });

  it('create de registro inédito continua incluindo approvalStatus e isRelevant', async () => {
    await persistirDecisoesStf([decisao()], {});
    const data = mockCreate.mock.calls[0][0].data;
    expect(data).toHaveProperty('approvalStatus');
    expect(data).toHaveProperty('isRelevant');
  });
});

/**
 * Em 30/08/2026, auditar por que um julgado entrou no acervo exigiu reabrir o
 * corpus de coleta: o insumo da amarração não ficava em lugar nenhum do banco.
 * No STJ a auditoria simplesmente não foi possível. O bloco bruto passa a ser
 * preservado para que a mesma medição seja reproduzível a partir do banco.
 */
describe('sourceRawData preserva a legislação citada', () => {
  it('grava o bloco bruto que originou a amarração', () => {
    const bloco = 'LEG-FED   LEI-014133 ANO-2021\n    ART-00075\n    LEI ORDINÁRIA';
    const dados = montarDadosStf(
      decisao({ legislacaoCitada: bloco, artigos14133: ['75'] }),
      CLASSIFICACAO,
      null,
    );
    expect(JSON.parse(dados.sourceRawData).legislacaoCitada).toBe(bloco);
  });

  it('grava null quando o julgado não traz legislação citada', () => {
    const dados = montarDadosStf(decisao({ legislacaoCitada: null }), CLASSIFICACAO, null);
    expect(JSON.parse(dados.sourceRawData).legislacaoCitada).toBeNull();
  });
});
