// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StjDecisaoNormalizada } from '../types';

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

import { persistirDecisoesStj, aplicarAmarracaoAutoritativa } from '../persistir';

function decisao(over: Partial<StjDecisaoNormalizada> = {}): StjDecisaoNormalizada {
  return {
    sourceId: '202402187409',
    fullIdentifier: 'stj-acordao-202402187409',
    decisionType: 'acordao',
    classe: 'REsp',
    decisionNumber: '202402187409',
    processNumber: '2669939',
    year: 2026,
    title: 'REsp 202402187409 - STJ',
    ementa: 'ADMINISTRATIVO. LICITAÇÃO.',
    relator: 'FRANCISCO FALCÃO',
    orgaoJulgador: 'PRIMEIRA SEÇÃO',
    dataJulgamento: new Date('2026-05-19T00:00:00Z'),
    dataPublicacao: new Date('2026-05-22T00:00:00Z'),
    url: 'https://processo.stj.jus.br/processo/pesquisa/?num_registro=202402187409',
    tema: null,
    tese: null,
    artigos14133: [],
    citaLei14133: false,
    ...over,
  };
}

const CLASSIFICACAO_FRACA = {
  relevanceScore: 20,
  approvalStatus: 'pending' as const,
  themes: [],
  leiArticles: [],
  reasoning: 'escore baixo',
  suggestedCourses: '',
  confidence: 0.4,
};

beforeEach(() => {
  mockFindUnique.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockClassify.mockReset().mockResolvedValue(CLASSIFICACAO_FRACA);
  mockSummary.mockReset().mockResolvedValue(null);
});

describe('aplicarAmarracaoAutoritativa', () => {
  it('aprova quando há artigo da 14.133, mesmo com escore baixo', () => {
    const r = aplicarAmarracaoAutoritativa(decisao({ artigos14133: ['75'] }), CLASSIFICACAO_FRACA);
    expect(r.approvalStatus).toBe('auto_approved');
  });

  it('não mexe no veredito quando não há amarração', () => {
    const r = aplicarAmarracaoAutoritativa(decisao(), CLASSIFICACAO_FRACA);
    expect(r.approvalStatus).toBe('pending');
  });

  it('preserva o escore medido pelo classificador', () => {
    const r = aplicarAmarracaoAutoritativa(decisao({ artigos14133: ['75'] }), CLASSIFICACAO_FRACA);
    expect(r.relevanceScore).toBe(20);
  });
});

describe('persistirDecisoesStj', () => {
  it('cria quando o julgado ainda não existe', async () => {
    mockFindUnique.mockResolvedValue(null);
    // veredito definido: com a classificação fraca (pending) o julgado seria
    // descartado por `descartarPendentes`, que é o default
    mockClassify.mockResolvedValue({ ...CLASSIFICACAO_FRACA, approvalStatus: 'auto_approved' });
    const r = await persistirDecisoesStj([decisao()], {});
    expect(r.criados).toBe(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('é idempotente: rodar de novo não cria segundo registro', async () => {
    mockFindUnique.mockResolvedValue({ id: 'x', reviewedBy: null, summary: null });
    const r = await persistirDecisoesStj([decisao()], {});
    expect(r.criados).toBe(0);
    expect(r.ignorados).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('atualiza quando forcar está ligado', async () => {
    mockFindUnique.mockResolvedValue({ id: 'x', reviewedBy: null, summary: null });
    mockClassify.mockResolvedValue({ ...CLASSIFICACAO_FRACA, approvalStatus: 'auto_approved' });
    const r = await persistirDecisoesStj([decisao()], { forcar: true });
    expect(r.atualizados).toBe(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('não recalcula o veredito de quem um humano já revisou', async () => {
    mockFindUnique.mockResolvedValue({ id: 'x', reviewedBy: 'daniel', summary: null });
    mockClassify.mockResolvedValue({ ...CLASSIFICACAO_FRACA, approvalStatus: 'auto_approved' });
    await persistirDecisoesStj([decisao()], { forcar: true });
    const dados = mockUpdate.mock.calls[0][0].data;
    expect(dados).not.toHaveProperty('approvalStatus');
    expect(dados).not.toHaveProperty('isRelevant');
  });

  it('grava leiArticlesArr a partir do campo estruturado, não do classificador', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockClassify.mockResolvedValue({ ...CLASSIFICACAO_FRACA, leiArticles: ['37'] });
    await persistirDecisoesStj([decisao({ artigos14133: ['75'] })], {});
    const dados = mockCreate.mock.calls[0][0].data;
    expect(dados.leiArticlesArr).toEqual(['75']);
  });

  it('não chama o Gemini quando gerarResumo está desligado', async () => {
    mockFindUnique.mockResolvedValue(null);
    await persistirDecisoesStj([decisao({ artigos14133: ['75'] })], { gerarResumo: false });
    expect(mockSummary).not.toHaveBeenCalled();
  });

  it('descarta o julgado que fica pending, sem gravar', async () => {
    mockFindUnique.mockResolvedValue(null);
    const r = await persistirDecisoesStj([decisao()], {});
    expect(r.criados).toBe(0);
    expect(r.ignorados).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('grava o julgado auto_rejected — veredito definido entra', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockClassify.mockResolvedValue({ ...CLASSIFICACAO_FRACA, approvalStatus: 'auto_rejected' });
    const r = await persistirDecisoesStj([decisao()], {});
    expect(r.criados).toBe(1);
  });

  it('em dry-run não escreve, mas classifica — e descarta quem ficaria pending', async () => {
    mockFindUnique.mockResolvedValue(null);
    // mock padrão do beforeEach já resolve CLASSIFICACAO_FRACA (pending)
    const r = await persistirDecisoesStj([decisao()], { dryRun: true });
    expect(r.criados).toBe(0);
    expect(r.ignorados).toBe(1);
    expect(mockClassify).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('em dry-run conta criados quando a classificação aprovaria, sem gravar', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockClassify.mockResolvedValue({ ...CLASSIFICACAO_FRACA, approvalStatus: 'auto_approved' });
    const r = await persistirDecisoesStj([decisao()], { dryRun: true });
    expect(r.criados).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('em dry-run nunca chama o Gemini, mesmo com julgado que seria aprovado', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockClassify.mockResolvedValue({ ...CLASSIFICACAO_FRACA, approvalStatus: 'auto_approved' });
    await persistirDecisoesStj([decisao()], { dryRun: true });
    expect(mockSummary).not.toHaveBeenCalled();
  });

  it('um erro em uma decisão não aborta as demais', async () => {
    mockClassify.mockResolvedValue({ ...CLASSIFICACAO_FRACA, approvalStatus: 'auto_approved' });
    mockFindUnique.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('rede caiu')).mockResolvedValueOnce(null);
    const r = await persistirDecisoesStj(
      [decisao({ fullIdentifier: 'a' }), decisao({ fullIdentifier: 'b' }), decisao({ fullIdentifier: 'c' })],
      {}
    );
    expect(r.erros).toBe(1);
    expect(r.criados).toBe(2);
  });
});
