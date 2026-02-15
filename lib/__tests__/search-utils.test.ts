/**
 * Testes para lib/search-utils.ts
 *
 * Testa funções de busca e filtragem de documentos.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock do módulo de artigos da Lei 14.133
vi.mock('@/data/lei-14133-artigos', () => ({
  LEI_14133_ARTIGOS: {
    '1': { ementa: 'Licitação e contratos administrativos' },
    '72': { ementa: 'Dispensa de licitação' },
    '75': { ementa: 'Inexigibilidade de licitação' },
  } as Record<string, { ementa: string }>,
}));

// Mock do hook (apenas tipos, não a implementação)
vi.mock('@/hooks/use-search', () => ({}));

import {
  normalizeText,
  matchesSearchTerm,
  matchesFilters,
  calculateRelevanceScore,
  sortDocuments,
  searchAndFilterDocuments,
  highlightSearchTerms,
} from '../search-utils';
import type { DocumentType, SearchFilters } from '@/hooks/use-search';

function makeDoc(overrides: Partial<DocumentType> = {}): DocumentType {
  return {
    id: 'doc-1',
    title: 'Manual de Licitações',
    description: 'Guia completo de licitações',
    type: 'pdf',
    category: 'apostila',
    courseId: 'course-1',
    tags: '["licitação","manual"]',
    uploadedAt: '2025-01-15T00:00:00Z',
    ...overrides,
  };
}

function makeFilters(overrides: Partial<SearchFilters> = {}): SearchFilters {
  return {
    courseIds: [],
    categories: [],
    types: [],
    leiArticles: [],
    dateRange: 'all',
    favoritesOnly: false,
    sortBy: 'relevance',
    ...overrides,
  };
}

describe('search-utils', () => {
  describe('normalizeText', () => {
    it('deve converter para minúsculo', () => {
      expect(normalizeText('ABC')).toBe('abc');
    });

    it('deve remover acentos', () => {
      expect(normalizeText('Licitação')).toBe('licitacao');
    });

    it('deve normalizar acentos complexos', () => {
      expect(normalizeText('Ação Pública Índice Órgão Único')).toBe('acao publica indice orgao unico');
    });

    it('deve lidar com string vazia', () => {
      expect(normalizeText('')).toBe('');
    });
  });

  describe('matchesSearchTerm', () => {
    it('deve retornar true para termo vazio', () => {
      expect(matchesSearchTerm(makeDoc(), '')).toBe(true);
      expect(matchesSearchTerm(makeDoc(), '   ')).toBe(true);
    });

    it('deve encontrar termo no título', () => {
      expect(matchesSearchTerm(makeDoc(), 'manual')).toBe(true);
    });

    it('deve encontrar termo na descrição', () => {
      expect(matchesSearchTerm(makeDoc(), 'guia completo')).toBe(true);
    });

    it('deve encontrar termo nas tags', () => {
      expect(matchesSearchTerm(makeDoc(), 'licitação')).toBe(true);
    });

    it('deve encontrar termo na categoria', () => {
      expect(matchesSearchTerm(makeDoc(), 'apostila')).toBe(true);
    });

    it('deve encontrar termo no conteúdo', () => {
      const doc = makeDoc({ content: 'Texto sobre pregão eletrônico' });
      expect(matchesSearchTerm(doc, 'pregão')).toBe(true);
    });

    it('deve buscar sem considerar acentos', () => {
      expect(matchesSearchTerm(makeDoc(), 'licitacao')).toBe(true);
    });

    it('deve retornar false se termo não encontrado', () => {
      expect(matchesSearchTerm(makeDoc(), 'blockchain')).toBe(false);
    });

    it('deve buscar em artigos da Lei 14.133 por número', () => {
      const doc = makeDoc({ leiArticles: '["72"]' });
      expect(matchesSearchTerm(doc, '72')).toBe(true);
    });

    it('deve buscar na ementa dos artigos da Lei 14.133', () => {
      const doc = makeDoc({ leiArticles: '["72"]' });
      expect(matchesSearchTerm(doc, 'dispensa')).toBe(true);
    });

    it('deve lidar com leiArticles inválido', () => {
      const doc = makeDoc({ leiArticles: 'invalid-json' });
      expect(matchesSearchTerm(doc, 'artigo')).toBe(false);
    });
  });

  describe('matchesFilters', () => {
    it('deve retornar true sem filtros', () => {
      expect(matchesFilters(makeDoc(), makeFilters())).toBe(true);
    });

    it('deve filtrar por courseId', () => {
      expect(matchesFilters(
        makeDoc({ courseId: 'course-1' }),
        makeFilters({ courseIds: ['course-1'] }),
      )).toBe(true);

      expect(matchesFilters(
        makeDoc({ courseId: 'course-2' }),
        makeFilters({ courseIds: ['course-1'] }),
      )).toBe(false);
    });

    it('deve filtrar por categoria', () => {
      expect(matchesFilters(
        makeDoc({ category: 'apostila' }),
        makeFilters({ categories: ['apostila'] }),
      )).toBe(true);

      expect(matchesFilters(
        makeDoc({ category: 'parecer' }),
        makeFilters({ categories: ['apostila'] }),
      )).toBe(false);
    });

    it('deve filtrar por tipo', () => {
      expect(matchesFilters(
        makeDoc({ type: 'pdf' }),
        makeFilters({ types: ['pdf'] }),
      )).toBe(true);

      expect(matchesFilters(
        makeDoc({ type: 'video' }),
        makeFilters({ types: ['pdf'] }),
      )).toBe(false);
    });

    it('deve filtrar por artigos da Lei 14.133', () => {
      expect(matchesFilters(
        makeDoc({ leiArticles: '["72","75"]' }),
        makeFilters({ leiArticles: ['72'] }),
      )).toBe(true);

      expect(matchesFilters(
        makeDoc({ leiArticles: '["1"]' }),
        makeFilters({ leiArticles: ['72'] }),
      )).toBe(false);
    });

    it('deve retornar false se doc não tem leiArticles e filtro exige', () => {
      expect(matchesFilters(
        makeDoc({ leiArticles: undefined }),
        makeFilters({ leiArticles: ['72'] }),
      )).toBe(false);
    });

    it('deve filtrar por data 7 dias', () => {
      const recent = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

      expect(matchesFilters(makeDoc({ uploadedAt: recent }), makeFilters({ dateRange: '7days' }))).toBe(true);
      expect(matchesFilters(makeDoc({ uploadedAt: old }), makeFilters({ dateRange: '7days' }))).toBe(false);
    });

    it('deve filtrar por data 30 dias', () => {
      const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      expect(matchesFilters(makeDoc({ uploadedAt: recent }), makeFilters({ dateRange: '30days' }))).toBe(true);
      expect(matchesFilters(makeDoc({ uploadedAt: old }), makeFilters({ dateRange: '30days' }))).toBe(false);
    });

    it('deve filtrar por data 90 dias', () => {
      const recent = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const old = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();

      expect(matchesFilters(makeDoc({ uploadedAt: recent }), makeFilters({ dateRange: '90days' }))).toBe(true);
      expect(matchesFilters(makeDoc({ uploadedAt: old }), makeFilters({ dateRange: '90days' }))).toBe(false);
    });

    it('deve filtrar por data custom', () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-06-30');

      expect(matchesFilters(
        makeDoc({ uploadedAt: '2025-03-15T00:00:00Z' }),
        makeFilters({ dateRange: 'custom', customDateStart: start, customDateEnd: end }),
      )).toBe(true);

      expect(matchesFilters(
        makeDoc({ uploadedAt: '2024-06-01T00:00:00Z' }),
        makeFilters({ dateRange: 'custom', customDateStart: start, customDateEnd: end }),
      )).toBe(false);
    });

    it('deve filtrar por favoritos', () => {
      expect(matchesFilters(
        makeDoc({ id: 'doc-1' }),
        makeFilters({ favoritesOnly: true }),
        ['doc-1'],
      )).toBe(true);

      expect(matchesFilters(
        makeDoc({ id: 'doc-2' }),
        makeFilters({ favoritesOnly: true }),
        ['doc-1'],
      )).toBe(false);
    });
  });

  describe('calculateRelevanceScore', () => {
    it('deve retornar 0 para termo vazio', () => {
      expect(calculateRelevanceScore(makeDoc(), '')).toBe(0);
    });

    it('deve dar mais peso para match no título', () => {
      const doc = makeDoc({ title: 'Manual de Licitações', description: 'Guia de licitações' });
      const score = calculateRelevanceScore(doc, 'manual');
      expect(score).toBeGreaterThan(0);
    });

    it('deve dar bonus para match no início do título', () => {
      const doc = makeDoc({ title: 'Manual de Licitações' });
      const score = calculateRelevanceScore(doc, 'manual');
      // Deve ter score alto pelo match no título + bonus por início
      expect(score).toBeGreaterThanOrEqual(30);
    });

    it('deve dar bonus forte para match exato de artigo', () => {
      const doc = makeDoc({ leiArticles: '["72"]' });
      const score = calculateRelevanceScore(doc, '72');
      expect(score).toBeGreaterThanOrEqual(15);
    });

    it('deve dar pontuação para match nas tags', () => {
      const doc = makeDoc({ tags: '["pregão","licitação"]' });
      const score = calculateRelevanceScore(doc, 'pregão');
      expect(score).toBeGreaterThan(0);
    });

    it('deve dar pontuação para match no conteúdo', () => {
      const doc = makeDoc({ content: 'Texto sobre pregão eletrônico' });
      const score = calculateRelevanceScore(doc, 'pregão');
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('sortDocuments', () => {
    const docs = [
      makeDoc({ id: '1', title: 'B - Doc', uploadedAt: '2025-01-01T00:00:00Z' }),
      makeDoc({ id: '2', title: 'A - Doc', uploadedAt: '2025-06-01T00:00:00Z' }),
      makeDoc({ id: '3', title: 'C - Doc', uploadedAt: '2025-03-01T00:00:00Z' }),
    ];

    it('deve ordenar por relevância', () => {
      const sorted = sortDocuments(
        [makeDoc({ title: 'Outro doc' }), makeDoc({ title: 'Manual de Licitações' })],
        'relevance',
        'manual',
      );
      expect(sorted[0].title).toBe('Manual de Licitações');
    });

    it('deve ordenar por mais recentes', () => {
      const sorted = sortDocuments(docs, 'newest');
      expect(sorted[0].id).toBe('2');
    });

    it('deve ordenar por mais antigos', () => {
      const sorted = sortDocuments(docs, 'oldest');
      expect(sorted[0].id).toBe('1');
    });

    it('deve ordenar A-Z', () => {
      const sorted = sortDocuments(docs, 'az');
      expect(sorted[0].title).toBe('A - Doc');
    });

    it('deve ordenar Z-A', () => {
      const sorted = sortDocuments(docs, 'za');
      expect(sorted[0].title).toBe('C - Doc');
    });

    it('não deve mutar array original', () => {
      const original = [...docs];
      sortDocuments(docs, 'newest');
      expect(docs).toEqual(original);
    });
  });

  describe('searchAndFilterDocuments', () => {
    it('deve combinar busca e filtros', () => {
      const docs = [
        makeDoc({ id: '1', title: 'Manual de Licitações', category: 'apostila' }),
        makeDoc({ id: '2', title: 'Parecer AGU', category: 'parecer' }),
        makeDoc({ id: '3', title: 'Manual de Contratos', category: 'apostila' }),
      ];

      const result = searchAndFilterDocuments(
        docs,
        'manual',
        makeFilters({ categories: ['apostila'] }),
      );

      expect(result).toHaveLength(2);
      expect(result.every(d => d.category === 'apostila')).toBe(true);
    });

    it('deve retornar vazio quando nada corresponde', () => {
      const result = searchAndFilterDocuments(
        [makeDoc()],
        'blockchain',
        makeFilters(),
      );
      expect(result).toHaveLength(0);
    });
  });

  describe('highlightSearchTerms', () => {
    it('deve retornar texto original para termo vazio', () => {
      expect(highlightSearchTerms('Hello World', '')).toBe('Hello World');
    });

    it('deve adicionar marcações de highlight', () => {
      const result = highlightSearchTerms('Manual de licitações', 'manual');
      expect(result).toContain('<mark>');
    });

    it('deve escapar caracteres regex no termo', () => {
      // Não deve lançar erro
      const result = highlightSearchTerms('Texto (com) parênteses', '(com)');
      expect(result).toBeDefined();
    });
  });
});
