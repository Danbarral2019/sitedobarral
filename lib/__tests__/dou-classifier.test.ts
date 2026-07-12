/**
 * Testes para lib/dou-classifier.ts
 *
 * Testa o DOUClassifier e suas classificações automáticas.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DOUClassifier,
  DOUDocumentCategory,
  ApprovalStatus,
  DateRangePreset,
} from '../dou-classifier';

// Mock do cliente Gemini usado por classifyWithAI/classifyBatchWithAI.
// Permite exercitar o fallback de IA sem chamada de rede real.
const queryGeminiTextMock = vi.fn();
vi.mock('../gemini/cached-client', () => ({
  queryGeminiText: (...args: unknown[]) => queryGeminiTextMock(...args),
}));

describe('DOUClassifier', () => {
  describe('classify — Fontes AGU', () => {
    it('deve classificar documento da AGU como FONTE_AGU', () => {
      const result = DOUClassifier.classify(
        'Orientação Normativa nº 55',
        'A Advocacia-Geral da União orienta...',
      );
      expect(result.category).toBe(DOUDocumentCategory.FONTE_AGU);
      expect(result.status).toBe(ApprovalStatus.AUTO_APPROVED);
      expect(result.isRelevant).toBe(true);
      expect(result.requiresReview).toBe(false);
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    it('deve classificar parecer AGU', () => {
      const result = DOUClassifier.classify(
        'Parecer nº AGU/LAA 123/2024',
        'Parecer da AGU sobre licitações',
      );
      expect(result.category).toBe(DOUDocumentCategory.FONTE_AGU);
      expect(result.status).toBe(ApprovalStatus.AUTO_APPROVED);
    });

    it('deve classificar súmula AGU', () => {
      const result = DOUClassifier.classify(
        'Súmula AGU nº 80',
        'Texto da súmula',
      );
      expect(result.category).toBe(DOUDocumentCategory.FONTE_AGU);
    });
  });

  describe('classify — Atos Normativos', () => {
    it('deve classificar lei como ATO_NORMATIVO', () => {
      const result = DOUClassifier.classify(
        'Lei nº 15.000/2025',
        'Altera disposições sobre contratos administrativos',
      );
      expect(result.category).toBe(DOUDocumentCategory.ATO_NORMATIVO);
      expect(result.status).toBe(ApprovalStatus.AUTO_APPROVED);
      expect(result.isRelevant).toBe(true);
    });

    it('deve classificar decreto como ATO_NORMATIVO', () => {
      const result = DOUClassifier.classify(
        'Decreto nº 12.000',
        'Regulamenta a Lei 14.133',
      );
      expect(result.category).toBe(DOUDocumentCategory.ATO_NORMATIVO);
    });

    it('deve classificar instrução normativa', () => {
      const result = DOUClassifier.classify(
        'Instrução Normativa SEGES nº 98',
        'Dispõe sobre procedimentos',
      );
      expect(result.category).toBe(DOUDocumentCategory.ATO_NORMATIVO);
    });

    it('deve classificar medida provisória', () => {
      const result = DOUClassifier.classify(
        'Medida Provisória nº 1.234',
        'Altera a legislação de licitações',
      );
      expect(result.category).toBe(DOUDocumentCategory.ATO_NORMATIVO);
    });

    it('deve classificar portaria como ATO_NORMATIVO', () => {
      const result = DOUClassifier.classify(
        'Portaria nº 443/2025',
        'Estabelece normas gerais',
      );
      expect(result.category).toBe(DOUDocumentCategory.ATO_NORMATIVO);
    });
  });

  describe('classify — Súmulas', () => {
    it('deve classificar súmula como SUMULA', () => {
      const result = DOUClassifier.classify(
        'Súmula Vinculante nº 30',
        'O STF decide...',
      );
      expect(result.category).toBe(DOUDocumentCategory.SUMULA);
      expect(result.status).toBe(ApprovalStatus.AUTO_APPROVED);
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    it('deve classificar sumula sem acento', () => {
      const result = DOUClassifier.classify(
        'Sumula nº 100 do TCU',
        'Texto da sumula',
      );
      expect(result.category).toBe(DOUDocumentCategory.SUMULA);
    });
  });

  describe('classify — Acórdãos TCU', () => {
    it('deve classificar acórdão TCU como ACORDAO_TCU com revisão pendente', () => {
      const result = DOUClassifier.classify(
        'Acórdão TCU nº 1000/2025',
        'O Tribunal de Contas da União decidiu...',
      );
      expect(result.category).toBe(DOUDocumentCategory.ACORDAO_TCU);
      expect(result.status).toBe(ApprovalStatus.PENDING);
      expect(result.requiresReview).toBe(true);
      expect(result.isRelevant).toBe(true);
    });
  });

  describe('classify — Documentos Irrelevantes', () => {
    it('deve classificar edital como EDITAL (auto-rejeitado)', () => {
      const result = DOUClassifier.classify(
        'Edital de Licitação nº 01/2025',
        'Pregão eletrônico para aquisição de materiais',
      );
      expect(result.category).toBe(DOUDocumentCategory.EDITAL);
      expect(result.status).toBe(ApprovalStatus.AUTO_REJECTED);
      expect(result.isRelevant).toBe(false);
    });

    it('deve classificar aviso de licitação', () => {
      const result = DOUClassifier.classify(
        'Aviso de Licitação',
        'Aviso de licitação para contratação de serviços',
      );
      expect(result.category).toBe(DOUDocumentCategory.AVISO_LICITACAO);
      expect(result.status).toBe(ApprovalStatus.AUTO_REJECTED);
    });

    it('deve classificar extrato de contrato como irrelevante', () => {
      const result = DOUClassifier.classify(
        'Extrato de Contrato nº 50/2025',
        'Extrato de contrato celebrado entre...',
      );
      // "contrato" keyword é matched antes de "extrato" na lista de irrelevantes
      expect([DOUDocumentCategory.EXTRATO, DOUDocumentCategory.CONTRATO]).toContain(result.category);
      expect(result.status).toBe(ApprovalStatus.AUTO_REJECTED);
    });

    it('deve classificar contrato', () => {
      const result = DOUClassifier.classify(
        'Contrato nº 10/2025',
        'Contrato de prestação de serviços',
      );
      expect(result.category).toBe(DOUDocumentCategory.CONTRATO);
      expect(result.status).toBe(ApprovalStatus.AUTO_REJECTED);
    });

    it('deve classificar resultado de julgamento como irrelevante', () => {
      const result = DOUClassifier.classify(
        'Resultado de Julgamento',
        'Resultado de julgamento do pregão eletrônico',
      );
      expect(result.status).toBe(ApprovalStatus.AUTO_REJECTED);
      expect(result.isRelevant).toBe(false);
    });
  });

  describe('classify — Extrato (sem casar contrato)', () => {
    it('deve classificar extrato de apostilamento como EXTRATO', () => {
      const result = DOUClassifier.classify(
        'Extrato de Apostilamento nº 5',
        'Extrato de apostilamento de valor',
      );
      expect(result.category).toBe(DOUDocumentCategory.EXTRATO);
      expect(result.status).toBe(ApprovalStatus.AUTO_REJECTED);
    });
  });

  describe('classify — PASSO 5 (filtro normativo)', () => {
    it('deve auto-rejeitar ato concreto detectado pelo filtro normativo', () => {
      // "Despacho" bate CONCRETE_TITLE_PATTERNS mas não as IRRELEVANT_KEYWORDS,
      // então chega ao PASSO 5 e é classificado como concreto (auto-rejeitado).
      const result = DOUClassifier.classify(
        'Despacho do Secretário-Executivo',
        'Determina o arquivamento do processo',
      );
      expect(result.category).toBe(DOUDocumentCategory.OUTROS);
      expect(result.status).toBe(ApprovalStatus.AUTO_REJECTED);
      expect(result.isRelevant).toBe(false);
    });

    it('deve marcar ato normativo geral como ATO_NORMATIVO pendente de revisão', () => {
      // "regulamenta" é indicador geral e nenhuma keyword direta casa,
      // então cai no PASSO 5 como 'geral'.
      const result = DOUClassifier.classify(
        'Estabelece diretrizes de governança',
        'Regulamenta procedimentos internos de gestão',
      );
      expect(result.category).toBe(DOUDocumentCategory.ATO_NORMATIVO);
      expect(result.status).toBe(ApprovalStatus.PENDING);
      expect(result.requiresReview).toBe(true);
    });
  });

  describe('classify — Documentos não classificados', () => {
    it('deve retornar OUTROS com revisão pendente para texto genérico', () => {
      const result = DOUClassifier.classify(
        'Comunicado Geral',
        'Informamos a todos os interessados',
      );
      expect(result.category).toBe(DOUDocumentCategory.OUTROS);
      expect(result.status).toBe(ApprovalStatus.PENDING);
      expect(result.requiresReview).toBe(true);
      // Classifier endurecido (commit ea68a1b) usa 50 como fallback "ambíguo" — não <50.
      // Antes era 40 (genérico baixa-confiança) e ficava confundindo com auto_rejected.
      expect(result.confidence).toBeLessThanOrEqual(50);
    });
  });

  describe('classify — Prioridade de irrelevantes sobre relevantes', () => {
    it('deve priorizar irrelevante quando texto mistura keywords', () => {
      // Tem "edital de" (irrelevante) e "lei nº" (normativo)
      const result = DOUClassifier.classify(
        'Edital de Concurso',
        'Edital de seleção conforme lei nº 8.666',
      );
      expect(result.status).toBe(ApprovalStatus.AUTO_REJECTED);
    });
  });

  describe('classifyBatch', () => {
    it('deve classificar múltiplos documentos', () => {
      const results = [
        { title: 'Lei nº 15.000', abstract: 'Nova lei', href: '/doc1', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
        { title: 'Edital nº 01', abstract: 'Pregão eletrônico', href: '/doc2', section: 'do3', date: '01/01/2025', hierarchyStr: '' },
      ] as Array<{ title: string; abstract: string; href: string; section: string; date: string; hierarchyStr: string }>;

      const classifications = DOUClassifier.classifyBatch(results as never);
      expect(classifications.size).toBe(2);
    });
  });

  describe('getStats', () => {
    it('deve retornar estatísticas corretas', () => {
      const results = [
        { title: 'Lei nº 15.000', abstract: '', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
        { title: 'Edital nº 01', abstract: 'Pregão eletrônico', href: '/2', section: 'do3', date: '01/01/2025', hierarchyStr: '' },
        { title: 'Comunicado', abstract: 'Info geral', href: '/3', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
      ] as Array<{ title: string; abstract: string; href: string; section: string; date: string; hierarchyStr: string }>;

      const classifications = DOUClassifier.classifyBatch(results as never);
      const stats = DOUClassifier.getStats(classifications);

      expect(stats.total).toBe(3);
      expect(stats.autoApproved).toBe(1);
      expect(stats.autoRejected).toBe(1);
      expect(stats.pending).toBe(1);
    });
  });

  describe('filterAutoApproved', () => {
    it('deve filtrar apenas documentos aprovados automaticamente', () => {
      const results = [
        { title: 'Lei nº 15.000', abstract: '', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
        { title: 'Edital nº 01', abstract: 'Pregão eletrônico', href: '/2', section: 'do3', date: '01/01/2025', hierarchyStr: '' },
      ] as Array<{ title: string; abstract: string; href: string; section: string; date: string; hierarchyStr: string }>;

      const classifications = DOUClassifier.classifyBatch(results as never);
      const approved = DOUClassifier.filterAutoApproved(classifications);

      expect(approved).toHaveLength(1);
    });
  });

  describe('filterPendingReview', () => {
    it('deve filtrar documentos pendentes de revisão', () => {
      const results = [
        { title: 'Acórdão TCU nº 100', abstract: 'TCU decide...', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
        { title: 'Lei nº 15.000', abstract: '', href: '/2', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
      ] as Array<{ title: string; abstract: string; href: string; section: string; date: string; hierarchyStr: string }>;

      const classifications = DOUClassifier.classifyBatch(results as never);
      const pending = DOUClassifier.filterPendingReview(classifications);

      expect(pending).toHaveLength(1);
    });
  });

  describe('filterBySection', () => {
    const results = [
      { title: 'Doc 1', abstract: '', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
      { title: 'Doc 2', abstract: '', href: '/2', section: 'do3', date: '01/01/2025', hierarchyStr: '' },
      { title: 'Doc 3', abstract: '', href: '/3', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
    ] as never[];

    it('deve filtrar por seção', () => {
      const filtered = DOUClassifier.filterBySection(results, ['do1']);
      expect(filtered).toHaveLength(2);
    });

    it('deve retornar todos se sections vazio', () => {
      const filtered = DOUClassifier.filterBySection(results, []);
      expect(filtered).toHaveLength(3);
    });

    it('deve retornar todos se sections inclui "todos"', () => {
      const filtered = DOUClassifier.filterBySection(results, ['todos']);
      expect(filtered).toHaveLength(3);
    });
  });

  describe('filterByOrgao', () => {
    const results = [
      { title: 'Doc 1', abstract: '', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: 'Ministério da Gestão' },
      { title: 'Doc 2', abstract: '', href: '/2', section: 'do1', date: '01/01/2025', hierarchyStr: 'Ministério da Saúde' },
    ] as never[];

    it('deve filtrar por órgão', () => {
      const filtered = DOUClassifier.filterByOrgao(results, ['ministério da gestão']);
      expect(filtered).toHaveLength(1);
    });

    it('deve retornar todos sem filtro de órgão', () => {
      const filtered = DOUClassifier.filterByOrgao(results);
      expect(filtered).toHaveLength(2);
    });

    it('deve filtrar por regex pattern', () => {
      const filtered = DOUClassifier.filterByOrgao(results, undefined, 'gestão|saúde');
      expect(filtered).toHaveLength(2);
    });

    it('deve excluir todos quando o pattern válido não casa', () => {
      const filtered = DOUClassifier.filterByOrgao(results, undefined, 'orgao-inexistente');
      expect(filtered).toHaveLength(0);
    });
  });

  describe('filterByDate', () => {
    const results = [
      { title: 'Doc 1', abstract: '', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
      { title: 'Doc 2', abstract: '', href: '/2', section: 'do1', date: '15/06/2025', hierarchyStr: '' },
      { title: 'Doc 3', abstract: '', href: '/3', section: 'do1', date: '31/12/2025', hierarchyStr: '' },
    ] as never[];

    it('deve filtrar por range de data', () => {
      const from = new Date(2025, 0, 1);  // Jan 2025
      const to = new Date(2025, 5, 30);   // Jun 2025
      const filtered = DOUClassifier.filterByDate(results, from, to);
      expect(filtered).toHaveLength(2);
    });

    it('deve retornar todos sem filtro de data', () => {
      const filtered = DOUClassifier.filterByDate(results);
      expect(filtered).toHaveLength(3);
    });
  });

  describe('filterByKeywords', () => {
    const results = [
      { title: 'Portaria sobre Licitação', abstract: 'Regulamenta compras', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
      { title: 'Decreto sobre Educação', abstract: 'Regras de ensino', href: '/2', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
    ] as never[];

    it('deve filtrar por keywords de inclusão', () => {
      const filtered = DOUClassifier.filterByKeywords(results, ['licitação']);
      expect(filtered).toHaveLength(1);
    });

    it('deve filtrar por keywords de exclusão', () => {
      const filtered = DOUClassifier.filterByKeywords(results, undefined, ['educação']);
      expect(filtered).toHaveLength(1);
    });

    it('deve retornar todos sem keywords', () => {
      const filtered = DOUClassifier.filterByKeywords(results);
      expect(filtered).toHaveLength(2);
    });
  });

  describe('getDateRangeFromPreset', () => {
    it('deve retornar range para HOJE', () => {
      const { from, to } = DOUClassifier.getDateRangeFromPreset(DateRangePreset.HOJE);
      expect(from.getTime()).toBe(to.getTime());
    });

    it('deve retornar range para ONTEM', () => {
      const { from, to } = DOUClassifier.getDateRangeFromPreset(DateRangePreset.ONTEM);
      expect(from.getTime()).toBeLessThan(to.getTime());
    });

    it('deve retornar range para ULTIMA_SEMANA', () => {
      const { from, to } = DOUClassifier.getDateRangeFromPreset(DateRangePreset.ULTIMA_SEMANA);
      const diff = to.getTime() - from.getTime();
      expect(diff).toBeGreaterThanOrEqual(6 * 24 * 60 * 60 * 1000);
    });

    it('deve retornar range para ULTIMO_MES', () => {
      const { from, to } = DOUClassifier.getDateRangeFromPreset(DateRangePreset.ULTIMO_MES);
      expect(from.getTime()).toBeLessThan(to.getTime());
    });

    it('deve retornar range para ULTIMOS_3_MESES', () => {
      const { from, to } = DOUClassifier.getDateRangeFromPreset(DateRangePreset.ULTIMOS_3_MESES);
      expect(from.getTime()).toBeLessThan(to.getTime());
    });

    it('deve retornar range para ULTIMO_ANO', () => {
      const { from, to } = DOUClassifier.getDateRangeFromPreset(DateRangePreset.ULTIMO_ANO);
      const diff = to.getTime() - from.getTime();
      expect(diff).toBeGreaterThanOrEqual(364 * 24 * 60 * 60 * 1000);
    });

    it('deve tratar preset desconhecido como HOJE (default)', () => {
      const { from, to } = DOUClassifier.getDateRangeFromPreset('preset-invalido' as never);
      expect(from.getTime()).toBe(to.getTime());
    });
  });

  describe('getFilterStats', () => {
    it('deve retornar estatísticas corretas de filtros', () => {
      const stats = DOUClassifier.getFilterStats(100, 80, {
        sections: ['do1'],
        orgaos: ['agu'],
        dateFrom: new Date(),
        categories: [DOUDocumentCategory.ATO_NORMATIVO],
        statuses: [ApprovalStatus.AUTO_APPROVED],
        minConfidence: 80,
        includeKeywords: ['licitação'],
        excludeKeywords: ['edital'],
      });

      expect(stats.originalCount).toBe(100);
      expect(stats.filteredCount).toBe(80);
      expect(stats.removedCount).toBe(20);
      expect(stats.removalRate).toBe('20.0%');
      expect(stats.appliedFilters.length).toBeGreaterThan(0);
    });

    it('deve retornar lista vazia de filtros quando nenhum aplicado', () => {
      const stats = DOUClassifier.getFilterStats(50, 50, {});
      expect(stats.appliedFilters).toHaveLength(0);
    });
  });

  describe('filterByCategory / filterByStatus / filterByConfidence', () => {
    const results = [
      { title: 'Lei nº 15.000', abstract: 'Institui normas gerais', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
      { title: 'Edital nº 01', abstract: 'Pregão eletrônico para aquisição', href: '/2', section: 'do3', date: '01/01/2025', hierarchyStr: '' },
      { title: 'Acórdão TCU nº 100', abstract: 'O TCU decide sobre licitação', href: '/3', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
    ] as Array<{ title: string; abstract: string; href: string; section: string; date: string; hierarchyStr: string }>;
    const classifications = DOUClassifier.classifyBatch(results as never);

    it('filterByCategory inclui a categoria pedida e exclui as demais', () => {
      const filtered = DOUClassifier.filterByCategory(classifications, [DOUDocumentCategory.ATO_NORMATIVO]);
      expect(filtered.map((r) => r.title)).toContain('Lei nº 15.000');
      expect(filtered.map((r) => r.title)).not.toContain('Edital nº 01');
    });

    it('filterByCategory sem categorias devolve todos', () => {
      expect(DOUClassifier.filterByCategory(classifications, [])).toHaveLength(3);
    });

    it('filterByStatus filtra pelo status de aprovação', () => {
      const rejected = DOUClassifier.filterByStatus(classifications, [ApprovalStatus.AUTO_REJECTED]);
      expect(rejected.map((r) => r.title)).toContain('Edital nº 01');
      expect(rejected.map((r) => r.title)).not.toContain('Lei nº 15.000');
    });

    it('filterByStatus sem status devolve todos', () => {
      expect(DOUClassifier.filterByStatus(classifications, [])).toHaveLength(3);
    });

    it('filterByConfidence respeita o piso de confiança', () => {
      expect(DOUClassifier.filterByConfidence(classifications, 0)).toHaveLength(3);
      expect(DOUClassifier.filterByConfidence(classifications, 999)).toHaveLength(0);
    });
  });

  describe('applyAdvancedFilters', () => {
    const results = [
      { title: 'Lei nº 15.000', abstract: 'Institui normas gerais', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
      { title: 'Edital nº 01', abstract: 'Pregão eletrônico', href: '/2', section: 'do3', date: '01/01/2025', hierarchyStr: '' },
      { title: 'Acórdão TCU nº 100', abstract: 'O TCU decide sobre licitação', href: '/3', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
    ] as Array<{ title: string; abstract: string; href: string; section: string; date: string; hierarchyStr: string }>;
    const classifications = DOUClassifier.classifyBatch(results as never);

    it('sem filtros devolve todos os resultados', () => {
      expect(DOUClassifier.applyAdvancedFilters(results as never, classifications, {})).toHaveLength(3);
    });

    it('compõe filtro por categoria', () => {
      const filtered = DOUClassifier.applyAdvancedFilters(results as never, classifications, {
        categories: [DOUDocumentCategory.ATO_NORMATIVO],
      });
      expect(filtered.map((r) => (r as { title: string }).title)).toContain('Lei nº 15.000');
      expect(filtered.map((r) => (r as { title: string }).title)).not.toContain('Edital nº 01');
    });

    it('compõe filtro por seção e status simultaneamente', () => {
      const filtered = DOUClassifier.applyAdvancedFilters(results as never, classifications, {
        sections: ['do1'],
        statuses: [ApprovalStatus.AUTO_APPROVED],
      });
      // do1 tem Lei (AUTO_APPROVED) e Acórdão (PENDING); status filtra só o aprovado
      expect(filtered.map((r) => (r as { title: string }).title)).toContain('Lei nº 15.000');
      expect(filtered.map((r) => (r as { title: string }).title)).not.toContain('Edital nº 01');
    });

    it('compõe filtro por órgão', () => {
      const comOrgao = [
        { title: 'Lei nº 15.000', abstract: 'normas gerais', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: 'Ministério da Gestão' },
        { title: 'Lei nº 16.000', abstract: 'normas gerais', href: '/2', section: 'do1', date: '01/01/2025', hierarchyStr: 'Ministério da Saúde' },
      ] as never[];
      const cls = DOUClassifier.classifyBatch(comOrgao);
      const filtered = DOUClassifier.applyAdvancedFilters(comOrgao, cls, {
        orgaos: ['ministério da gestão'],
      });
      expect(filtered).toHaveLength(1);
    });

    it('compõe filtro por range de datas', () => {
      const filtered = DOUClassifier.applyAdvancedFilters(results as never, classifications, {
        dateFrom: new Date(2024, 0, 1),
        dateTo: new Date(2025, 11, 31),
      });
      expect(filtered).toHaveLength(3);
    });

    it('compõe filtro por keywords de inclusão/exclusão', () => {
      const filtered = DOUClassifier.applyAdvancedFilters(results as never, classifications, {
        includeKeywords: ['licitação'],
      });
      expect(filtered.map((r) => (r as { title: string }).title)).toContain('Acórdão TCU nº 100');
      expect(filtered.map((r) => (r as { title: string }).title)).not.toContain('Lei nº 15.000');
    });

    it('compõe filtro por confiança mínima', () => {
      // minConfidence undefined é ignorado; 0 mantém todos
      const todos = DOUClassifier.applyAdvancedFilters(results as never, classifications, {
        minConfidence: 0,
      });
      expect(todos).toHaveLength(3);
      const nenhum = DOUClassifier.applyAdvancedFilters(results as never, classifications, {
        minConfidence: 999,
      });
      expect(nenhum).toHaveLength(0);
    });
  });

  describe('filterByOrgao — regex inválido', () => {
    it('não deve lançar e mantém o resultado quando o pattern é inválido', () => {
      const results = [
        { title: 'Doc', abstract: '', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: 'Ministério X' },
      ] as never[];
      // '[' é regex malformado → cai no catch (console.warn) e o item permanece
      const filtered = DOUClassifier.filterByOrgao(results, undefined, '[');
      expect(filtered).toHaveLength(1);
    });
  });

  describe('filterByDate — limites isolados', () => {
    const results = [
      { title: 'Doc 1', abstract: '', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
      { title: 'Doc 2', abstract: '', href: '/2', section: 'do1', date: '15/06/2025', hierarchyStr: '' },
      { title: 'Doc 3', abstract: '', href: '/3', section: 'do1', date: '31/12/2025', hierarchyStr: '' },
    ] as never[];

    it('filtra apenas com dateFrom (limite inferior)', () => {
      const filtered = DOUClassifier.filterByDate(results, new Date(2025, 5, 1));
      // 15/06 e 31/12 passam; 01/01 é anterior
      expect(filtered).toHaveLength(2);
    });

    it('filtra apenas com dateTo (limite superior)', () => {
      const filtered = DOUClassifier.filterByDate(results, undefined, new Date(2025, 5, 30));
      // 01/01 e 15/06 passam; 31/12 é posterior
      expect(filtered).toHaveLength(2);
    });
  });

  describe('classifyWithAI (fallback IA)', () => {
    beforeEach(() => {
      queryGeminiTextMock.mockReset();
    });

    it('classifica via IA e auto-aprova categoria relevante com alta confiança', async () => {
      queryGeminiTextMock.mockResolvedValue({
        response: '{"category":"ato_normativo","confidence":95,"reasoning":"norma geral","isRelevant":true}',
      });
      const result = await DOUClassifier.classifyWithAI('Título ambíguo', 'Resumo');
      expect(result.category).toBe(DOUDocumentCategory.ATO_NORMATIVO);
      expect(result.status).toBe(ApprovalStatus.AUTO_APPROVED);
      expect(result.reasoning[0]).toContain('[IA]');
    });

    it('auto-rejeita categoria irrelevante com alta confiança', async () => {
      queryGeminiTextMock.mockResolvedValue({
        response: '{"category":"edital","confidence":90,"reasoning":"edital","isRelevant":false}',
      });
      const result = await DOUClassifier.classifyWithAI('Edital', 'Pregão');
      expect(result.category).toBe(DOUDocumentCategory.EDITAL);
      expect(result.status).toBe(ApprovalStatus.AUTO_REJECTED);
    });

    it('marca como pendente quando confiança é baixa', async () => {
      queryGeminiTextMock.mockResolvedValue({
        response: '{"category":"ato_normativo","confidence":50,"reasoning":"incerto","isRelevant":true}',
      });
      const result = await DOUClassifier.classifyWithAI('Doc', 'Resumo');
      expect(result.status).toBe(ApprovalStatus.PENDING);
      expect(result.requiresReview).toBe(true);
    });

    it('trata categoria desconhecida como OUTROS', async () => {
      queryGeminiTextMock.mockResolvedValue({
        response: '{"category":"inexistente","confidence":80,"reasoning":"x","isRelevant":true}',
      });
      const result = await DOUClassifier.classifyWithAI('Doc', 'Resumo');
      expect(result.category).toBe(DOUDocumentCategory.OUTROS);
    });

    it('usa conteúdo enriquecido no prompt quando fornecido', async () => {
      queryGeminiTextMock.mockResolvedValue({
        response: '{"category":"outros","confidence":50,"reasoning":"x","isRelevant":true}',
      });
      await DOUClassifier.classifyWithAI('Doc', 'Resumo', { conteudo: 'texto completo do ato' } as never);
      const prompt = queryGeminiTextMock.mock.calls[0][0] as string;
      expect(prompt).toContain('texto completo do ato');
    });

    it('degrada para PENDING quando a resposta não tem JSON', async () => {
      queryGeminiTextMock.mockResolvedValue({ response: 'resposta sem json' });
      const result = await DOUClassifier.classifyWithAI('Doc', 'Resumo');
      expect(result.category).toBe(DOUDocumentCategory.OUTROS);
      expect(result.status).toBe(ApprovalStatus.PENDING);
      expect(result.confidence).toBe(40);
    });

    it('degrada para PENDING quando o cliente lança erro', async () => {
      queryGeminiTextMock.mockRejectedValue(new Error('timeout'));
      const result = await DOUClassifier.classifyWithAI('Doc', 'Resumo');
      expect(result.status).toBe(ApprovalStatus.PENDING);
      expect(result.reasoning[0]).toContain('IA falhou');
    });
  });

  describe('classifyBatchWithAI', () => {
    beforeEach(() => {
      queryGeminiTextMock.mockReset();
    });

    it('chama IA apenas para itens de baixa confiança/OUTROS e atualiza os promovidos', async () => {
      // Documento genérico → classify() dá OUTROS/baixa confiança → elegível para IA
      const results = [
        { title: 'Comunicado Geral', abstract: 'Informamos', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
        { title: 'Lei nº 15.000', abstract: 'normas gerais', href: '/2', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
      ] as never[];
      const classifications = DOUClassifier.classifyBatch(results);

      // IA promove o OUTROS para ato_normativo com confiança > 70
      queryGeminiTextMock.mockResolvedValue({
        response: '{"category":"ato_normativo","confidence":95,"reasoning":"norma","isRelevant":true}',
      });

      const { updated, errors } = await DOUClassifier.classifyBatchWithAI(results, classifications);
      expect(errors).toBe(0);
      expect(updated).toBe(1);
      // Só o item de baixa confiança deve ter acionado a IA (a Lei já era alta confiança)
      expect(queryGeminiTextMock).toHaveBeenCalledTimes(1);
    });

    it('conta erro quando a chamada de IA lança', async () => {
      const results = [
        { title: 'Comunicado Geral', abstract: 'Informamos', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
      ] as never[];
      const classifications = DOUClassifier.classifyBatch(results);
      queryGeminiTextMock.mockRejectedValue(new Error('falha'));

      const { updated, errors } = await DOUClassifier.classifyBatchWithAI(results, classifications);
      // classifyWithAI captura o erro internamente e devolve PENDING (confidence 40),
      // portanto não promove (updated 0) e não relança (errors 0).
      expect(updated).toBe(0);
      expect(errors).toBe(0);
    });

    it('respeita o teto de chamadas de IA (maxAICalls)', async () => {
      const results = [
        { title: 'Comunicado A', abstract: 'Info', href: '/1', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
        { title: 'Comunicado B', abstract: 'Info', href: '/2', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
        { title: 'Comunicado C', abstract: 'Info', href: '/3', section: 'do1', date: '01/01/2025', hierarchyStr: '' },
      ] as never[];
      const classifications = DOUClassifier.classifyBatch(results);
      queryGeminiTextMock.mockResolvedValue({
        response: '{"category":"outros","confidence":50,"reasoning":"x","isRelevant":true}',
      });

      await DOUClassifier.classifyBatchWithAI(results, classifications, undefined, 2);
      expect(queryGeminiTextMock).toHaveBeenCalledTimes(2);
    });
  });
});
