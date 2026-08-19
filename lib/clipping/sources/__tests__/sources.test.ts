// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockDocumentFindMany,
  mockTribunalDecisionFindMany,
  mockAnalyzeRelevanceTCU,
} = vi.hoisted(() => ({
  mockDocumentFindMany: vi.fn(),
  mockTribunalDecisionFindMany: vi.fn(),
  mockAnalyzeRelevanceTCU: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findMany: (...args: any[]) => mockDocumentFindMany(...args) },
    tribunalDecision: { findMany: (...args: any[]) => mockTribunalDecisionFindMany(...args) },
  },
}));

vi.mock('@/lib/tcu-module', () => ({
  analyzeRelevanceTCU: (...args: any[]) => mockAnalyzeRelevanceTCU(...args),
}));

import { fetchTcuItems } from '../tcu';
import { fetchTribunalItems } from '../tribunal';
import { fetchAllEligibleItems, sentRefKey } from '../index';

beforeEach(() => {
  mockDocumentFindMany.mockReset();
  mockTribunalDecisionFindMany.mockReset();
  mockAnalyzeRelevanceTCU.mockReset();
  mockAnalyzeRelevanceTCU.mockReturnValue({ score: 50 });
});

describe('sentRefKey', () => {
  it('forma chave kind:id', () => {
    expect(sentRefKey({ sourceKind: 'tribunal-decision', sourceId: 'abc' })).toBe('tribunal-decision:abc');
    expect(sentRefKey({ sourceKind: 'document-tcu', sourceId: 'xyz' })).toBe('document-tcu:xyz');
  });
});

describe('fetchTcuItems', () => {
  it('filtra acórdãos com score < threshold (15)', async () => {
    mockDocumentFindMany.mockResolvedValueOnce([
      { id: 'doc-low', title: 'baixo', description: '', content: null, url: null, tcuNumeroAcordao: 'AC-1/24', tcuEmentaCompleta: 'e', tcuRelator: null, tcuOrgaoJulgador: null, tcuLinkPDF: null, tcuDataJulgamento: null, uploadedAt: new Date() },
      { id: 'doc-high', title: 'alto', description: '', content: null, url: null, tcuNumeroAcordao: 'AC-2/24', tcuEmentaCompleta: 'e2', tcuRelator: null, tcuOrgaoJulgador: null, tcuLinkPDF: null, tcuDataJulgamento: null, uploadedAt: new Date() },
    ]);
    mockAnalyzeRelevanceTCU
      .mockReturnValueOnce({ score: 10 })
      .mockReturnValueOnce({ score: 20 });

    const items = await fetchTcuItems({ since: new Date(), until: new Date() });

    expect(items).toHaveLength(1);
    expect(items[0].sourceId).toBe('doc-high');
    expect(items[0].sourceKind).toBe('document-tcu');
    expect(items[0].tribunalCode).toBe('TCU');
    expect(items[0].relevanceScore).toBe(20);
  });

  it('exclui itens em alreadySentKeys', async () => {
    mockDocumentFindMany.mockResolvedValueOnce([
      { id: 'doc-1', title: 't1', description: '', content: null, url: null, tcuNumeroAcordao: null, tcuEmentaCompleta: 'e', tcuRelator: null, tcuOrgaoJulgador: null, tcuLinkPDF: null, tcuDataJulgamento: null, uploadedAt: new Date() },
      { id: 'doc-2', title: 't2', description: '', content: null, url: null, tcuNumeroAcordao: null, tcuEmentaCompleta: 'e', tcuRelator: null, tcuOrgaoJulgador: null, tcuLinkPDF: null, tcuDataJulgamento: null, uploadedAt: new Date() },
    ]);
    mockAnalyzeRelevanceTCU.mockReturnValue({ score: 50 });

    const items = await fetchTcuItems({
      since: new Date(),
      until: new Date(),
      alreadySentKeys: new Set(['document-tcu:doc-1']),
    });

    expect(items).toHaveLength(1);
    expect(items[0].sourceId).toBe('doc-2');
  });

  it('respeita limit', async () => {
    mockDocumentFindMany.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({
        id: `doc-${i}`, title: `t${i}`, description: '', content: null, url: null,
        tcuNumeroAcordao: null, tcuEmentaCompleta: 'e', tcuRelator: null,
        tcuOrgaoJulgador: null, tcuLinkPDF: null, tcuDataJulgamento: null,
        uploadedAt: new Date(),
      }))
    );
    mockAnalyzeRelevanceTCU.mockReturnValue({ score: 50 });

    const items = await fetchTcuItems({ since: new Date(), until: new Date(), limit: 3 });
    expect(items).toHaveLength(3);
  });

  it('usa content como fullText para TCU', async () => {
    mockDocumentFindMany.mockResolvedValueOnce([
      { id: 'doc-1', title: 't', description: '', content: 'inteiro teor TCU', url: null, tcuNumeroAcordao: null, tcuEmentaCompleta: 'ementa', tcuRelator: null, tcuOrgaoJulgador: null, tcuLinkPDF: null, tcuDataJulgamento: null, uploadedAt: new Date() },
    ]);

    const items = await fetchTcuItems({ since: new Date(), until: new Date() });
    expect(items[0].fullText).toBe('inteiro teor TCU');
    expect(items[0].ementa).toBe('ementa');
  });
});

describe('fetchTribunalItems — teto de idade por dataJulgamento', () => {
  const linha = (over = {}) => ({
    id: 'td-1', tribunalCode: 'STJ', tribunalName: 'STJ', decisionType: 'acordao',
    decisionNumber: '1', title: 't', ementa: 'e', fullText: null, relator: null,
    orgaoJulgador: null, dataJulgamento: new Date(), url: null, pdfUrl: null,
    relevanceScore: 90, createdAt: new Date(), ...over,
  });

  it('aplica teto de 3 meses por default', async () => {
    mockTribunalDecisionFindMany.mockResolvedValueOnce([linha()]);
    await fetchTribunalItems({ tribunalCode: 'STJ', windowDays: 14 });

    const where = mockTribunalDecisionFindMany.mock.calls[0][0].where;
    const limite = where.dataJulgamento.gte as Date;
    const esperado = new Date();
    esperado.setMonth(esperado.getMonth() - 3);
    // tolerancia de 1 dia para nao depender do instante exato da execucao
    expect(Math.abs(limite.getTime() - esperado.getTime())).toBeLessThan(24 * 3600 * 1000);
  });

  it('mantem createdAt como janela — trocar por dataJulgamento tiraria STF e STJ do clipping', async () => {
    mockTribunalDecisionFindMany.mockResolvedValueOnce([linha()]);
    await fetchTribunalItems({ tribunalCode: 'STJ', windowDays: 14 });

    const where = mockTribunalDecisionFindMany.mock.calls[0][0].where;
    // as duas datas coexistem, com papeis distintos: createdAt = "novidade para
    // nos"; dataJulgamento = "ainda e noticia". Coleta mensal leva 30-35 dias,
    // entao um julgado nunca caberia numa janela de 14 dias por data de julgamento.
    expect(where.createdAt).toBeDefined();
    expect(where.dataJulgamento).toBeDefined();
  });

  it('respeita CLIPPING_MAX_IDADE_MESES', async () => {
    const antes = process.env.CLIPPING_MAX_IDADE_MESES;
    process.env.CLIPPING_MAX_IDADE_MESES = '12';
    try {
      mockTribunalDecisionFindMany.mockResolvedValueOnce([linha()]);
      await fetchTribunalItems({ tribunalCode: 'STJ', windowDays: 14 });

      const limite = mockTribunalDecisionFindMany.mock.calls[0][0].where.dataJulgamento.gte as Date;
      const esperado = new Date();
      esperado.setMonth(esperado.getMonth() - 12);
      expect(Math.abs(limite.getTime() - esperado.getTime())).toBeLessThan(24 * 3600 * 1000);
    } finally {
      if (antes === undefined) delete process.env.CLIPPING_MAX_IDADE_MESES;
      else process.env.CLIPPING_MAX_IDADE_MESES = antes;
    }
  });

  it('env invalida cai no default de 3 meses em vez de quebrar', async () => {
    const antes = process.env.CLIPPING_MAX_IDADE_MESES;
    process.env.CLIPPING_MAX_IDADE_MESES = 'abc';
    try {
      mockTribunalDecisionFindMany.mockResolvedValueOnce([linha()]);
      await fetchTribunalItems({ tribunalCode: 'STJ', windowDays: 14 });

      const limite = mockTribunalDecisionFindMany.mock.calls[0][0].where.dataJulgamento.gte as Date;
      const esperado = new Date();
      esperado.setMonth(esperado.getMonth() - 3);
      expect(Math.abs(limite.getTime() - esperado.getTime())).toBeLessThan(24 * 3600 * 1000);
    } finally {
      if (antes === undefined) delete process.env.CLIPPING_MAX_IDADE_MESES;
      else process.env.CLIPPING_MAX_IDADE_MESES = antes;
    }
  });

  it('parametro explicito vence a env', async () => {
    mockTribunalDecisionFindMany.mockResolvedValueOnce([linha()]);
    await fetchTribunalItems({ tribunalCode: 'STJ', windowDays: 14, maxIdadeMeses: 1 });

    const limite = mockTribunalDecisionFindMany.mock.calls[0][0].where.dataJulgamento.gte as Date;
    const esperado = new Date();
    esperado.setMonth(esperado.getMonth() - 1);
    expect(Math.abs(limite.getTime() - esperado.getTime())).toBeLessThan(24 * 3600 * 1000);
  });
});

describe('fetchTribunalItems', () => {
  it('filtra por tribunalCode + approvalStatus + janela', async () => {
    mockTribunalDecisionFindMany.mockResolvedValueOnce([
      { id: 'td-1', tribunalCode: 'TCE-PE', tribunalName: 'TCE-PE', decisionType: 'parecer', decisionNumber: '698/26', title: 't', ementa: 'e', fullText: 'ft', relator: null, orgaoJulgador: null, dataJulgamento: null, url: null, pdfUrl: null, relevanceScore: 85, createdAt: new Date() },
    ]);

    await fetchTribunalItems({ tribunalCode: 'TCE-PE', windowDays: 14 });

    const callArg = mockTribunalDecisionFindMany.mock.calls[0][0];
    // Defesa em profundidade: match case-insensitive protege contra split de
    // case histórico no tribunalCode (decisões legadas minúsculas vs maiúsculas).
    expect(callArg.where.tribunalCode).toEqual({ equals: 'TCE-PE', mode: 'insensitive' });
    expect(callArg.where.approvalStatus).toEqual({ in: ['auto_approved', 'manually_approved'] });
    expect(callArg.where.createdAt).toHaveProperty('gte');
    expect(callArg.where.relevanceScore).toEqual({ gte: 55 });
  });

  it('match de tribunalCode é case-insensitive (aceita código minúsculo legado)', async () => {
    mockTribunalDecisionFindMany.mockResolvedValueOnce([]);
    await fetchTribunalItems({ tribunalCode: 'tce-pe', windowDays: 14 });

    const callArg = mockTribunalDecisionFindMany.mock.calls[0][0];
    expect(callArg.where.tribunalCode).toEqual({ equals: 'tce-pe', mode: 'insensitive' });
  });

  it('ordena por relevanceScore desc, depois dataJulgamento desc', async () => {
    mockTribunalDecisionFindMany.mockResolvedValueOnce([]);
    await fetchTribunalItems({ tribunalCode: 'TCE-PE', windowDays: 14 });

    const callArg = mockTribunalDecisionFindMany.mock.calls[0][0];
    expect(callArg.orderBy).toEqual([
      { relevanceScore: 'desc' },
      { dataJulgamento: 'desc' },
    ]);
  });

  it('exclui itens em alreadySentKeys', async () => {
    mockTribunalDecisionFindMany.mockResolvedValueOnce([
      { id: 'td-1', tribunalCode: 'TCE-PE', tribunalName: 'TCE-PE', decisionType: 'parecer', decisionNumber: '1', title: 't', ementa: 'e', fullText: null, relator: null, orgaoJulgador: null, dataJulgamento: null, url: null, pdfUrl: null, relevanceScore: 80, createdAt: new Date() },
      { id: 'td-2', tribunalCode: 'TCE-PE', tribunalName: 'TCE-PE', decisionType: 'parecer', decisionNumber: '2', title: 't', ementa: 'e', fullText: null, relator: null, orgaoJulgador: null, dataJulgamento: null, url: null, pdfUrl: null, relevanceScore: 80, createdAt: new Date() },
    ]);

    const items = await fetchTribunalItems({
      tribunalCode: 'TCE-PE',
      windowDays: 14,
      alreadySentKeys: new Set(['tribunal-decision:td-1']),
    });

    expect(items).toHaveLength(1);
    expect(items[0].sourceId).toBe('td-2');
  });

  it('respeita limit', async () => {
    mockTribunalDecisionFindMany.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({
        id: `td-${i}`, tribunalCode: 'TCE-PE', tribunalName: 'TCE-PE',
        decisionType: 'parecer', decisionNumber: String(i), title: 't', ementa: 'e',
        fullText: null, relator: null, orgaoJulgador: null, dataJulgamento: null,
        url: null, pdfUrl: null, relevanceScore: 80, createdAt: new Date(),
      }))
    );

    const items = await fetchTribunalItems({ tribunalCode: 'TCE-PE', windowDays: 14, limit: 3 });
    expect(items).toHaveLength(3);
  });

  it('preserva fullText (caminho crítico do fix RAG)', async () => {
    mockTribunalDecisionFindMany.mockResolvedValueOnce([
      { id: 'td-1', tribunalCode: 'TCE-PE', tribunalName: 'TCE-PE', decisionType: 'parecer', decisionNumber: '698/26', title: 't', ementa: 'e', fullText: 'inteiro teor capturado do HTML', relator: null, orgaoJulgador: null, dataJulgamento: null, url: null, pdfUrl: null, relevanceScore: 90, createdAt: new Date() },
    ]);

    const items = await fetchTribunalItems({ tribunalCode: 'TCE-PE', windowDays: 14 });
    expect(items[0].fullText).toBe('inteiro teor capturado do HTML');
  });
});

describe('fetchAllEligibleItems', () => {
  it('roteia TCU para fetchTcuItems e outros para fetchTribunalItems', async () => {
    mockDocumentFindMany.mockResolvedValueOnce([
      { id: 'doc-1', title: 't', description: 'desc', content: null, url: null, tcuNumeroAcordao: 'AC-1', tcuEmentaCompleta: 'e', tcuRelator: null, tcuOrgaoJulgador: null, tcuLinkPDF: null, tcuDataJulgamento: null, uploadedAt: new Date() },
    ]);
    mockAnalyzeRelevanceTCU.mockReturnValue({ score: 50 });
    mockTribunalDecisionFindMany.mockResolvedValueOnce([
      { id: 'td-1', tribunalCode: 'TCE-PE', tribunalName: 'TCE-PE', decisionType: 'parecer', decisionNumber: '698/26', title: 't', ementa: 'e', fullText: null, relator: null, orgaoJulgador: null, dataJulgamento: null, url: null, pdfUrl: null, relevanceScore: 80, createdAt: new Date() },
    ]);

    const groups = await fetchAllEligibleItems({
      enabledTribunais: ['TCU', 'TCE-PE'],
      tcuSince: new Date(),
      tcuUntil: new Date(),
      windowDays: 14,
      alreadySentKeys: new Set(),
      maxItemsPerTribunal: 5,
    });

    expect(groups.size).toBe(2);
    expect(groups.get('TCU')).toHaveLength(1);
    expect(groups.get('TCE-PE')).toHaveLength(1);
    expect(groups.get('TCU')?.[0].sourceKind).toBe('document-tcu');
    expect(groups.get('TCE-PE')?.[0].sourceKind).toBe('tribunal-decision');
  });

  it('omite tribunais sem itens elegíveis', async () => {
    mockDocumentFindMany.mockResolvedValueOnce([]);
    mockTribunalDecisionFindMany.mockResolvedValueOnce([]);

    const groups = await fetchAllEligibleItems({
      enabledTribunais: ['TCU', 'TCE-PE'],
      tcuSince: new Date(),
      tcuUntil: new Date(),
      windowDays: 14,
      alreadySentKeys: new Set(),
      maxItemsPerTribunal: 5,
    });

    expect(groups.size).toBe(0);
  });
});
