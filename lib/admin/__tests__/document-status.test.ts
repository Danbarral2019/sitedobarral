/**
 * Testes para lib/admin/document-status.ts
 *
 * Classifica documentos como complete/warning/critical conforme campos preenchidos.
 */

import { describe, it, expect } from 'vitest';
import { getDocCompletionStatus } from '../document-status';
import type { DocumentData } from '@/components/admin/DocumentCard';

function makeDoc(overrides: Partial<DocumentData> = {}): DocumentData {
  return {
    id: 'doc-1',
    title: 'Titulo de teste',
    description: 'Descricao de teste',
    category: 'acordao',
    type: 'pdf',
    url: 'https://example.com/doc.pdf',
    courseId: null,
    isPublic: true,
    uploadedAt: '2026-05-19T00:00:00.000Z',
    tags: '["tag1"]',
    leiArticles: '["75"]',
    ...overrides,
  } as DocumentData;
}

describe('getDocCompletionStatus', () => {
  describe('critical', () => {
    it('retorna critical quando title esta vazio', () => {
      expect(getDocCompletionStatus(makeDoc({ title: '' }))).toBe('critical');
    });

    it('retorna critical quando category esta vazio', () => {
      expect(getDocCompletionStatus(makeDoc({ category: '' }))).toBe('critical');
    });

    it('retorna critical para orientacao-normativa sem onNumber', () => {
      const doc = makeDoc({
        category: 'orientacao-normativa',
        onNumber: undefined,
        onYear: 2024,
      });
      expect(getDocCompletionStatus(doc)).toBe('critical');
    });

    it('retorna critical para orientacao-normativa sem onYear', () => {
      const doc = makeDoc({
        category: 'orientacao-normativa',
        onNumber: 1,
        onYear: undefined,
      });
      expect(getDocCompletionStatus(doc)).toBe('critical');
    });

    it('retorna critical para enunciados sem entityType', () => {
      const doc = makeDoc({ category: 'enunciados', entityType: undefined });
      expect(getDocCompletionStatus(doc)).toBe('critical');
    });

    it('retorna critical para sumula sem entityType', () => {
      const doc = makeDoc({ category: 'sumula', entityType: undefined });
      expect(getDocCompletionStatus(doc)).toBe('critical');
    });
  });

  describe('warning', () => {
    it('retorna warning quando tags E articles estao vazios', () => {
      const doc = makeDoc({ tags: '[]', leiArticles: '[]' });
      expect(getDocCompletionStatus(doc)).toBe('warning');
    });

    it('retorna warning quando description esta vazio mas tem tags', () => {
      const doc = makeDoc({ description: '', tags: '["x"]', leiArticles: '[]' });
      expect(getDocCompletionStatus(doc)).toBe('warning');
    });

    it('retorna warning quando tags e articles sao null/undefined', () => {
      const doc = makeDoc({ tags: undefined, leiArticles: undefined });
      expect(getDocCompletionStatus(doc)).toBe('warning');
    });
  });

  describe('complete', () => {
    it('retorna complete com todos os campos preenchidos', () => {
      expect(getDocCompletionStatus(makeDoc())).toBe('complete');
    });

    it('retorna complete quando so leiArticles tem valor (sem tags)', () => {
      const doc = makeDoc({ tags: '[]', leiArticles: '["75"]' });
      expect(getDocCompletionStatus(doc)).toBe('complete');
    });

    it('retorna complete para orientacao-normativa com onNumber e onYear', () => {
      const doc = makeDoc({
        category: 'orientacao-normativa',
        onNumber: 1,
        onYear: 2024,
      });
      expect(getDocCompletionStatus(doc)).toBe('complete');
    });

    it('retorna complete para enunciados com entityType', () => {
      const doc = makeDoc({ category: 'enunciados', entityType: 'IBDA' });
      expect(getDocCompletionStatus(doc)).toBe('complete');
    });
  });

  describe('formato de tags/articles', () => {
    it('aceita tags em formato CSV', () => {
      const doc = makeDoc({ tags: 'a,b,c' });
      expect(getDocCompletionStatus(doc)).toBe('complete');
    });

    it('aceita tags como array direto', () => {
      const doc = makeDoc({ tags: ['a', 'b'] });
      expect(getDocCompletionStatus(doc)).toBe('complete');
    });
  });
});
