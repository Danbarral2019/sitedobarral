/**
 * Testes para lib/lei-14133/article-status.ts
 *
 * Classifica artigos em 5 niveis conforme quantidade de documentos relacionados.
 */

import { describe, it, expect } from 'vitest';
import { getArticleStatus } from '../article-status';

describe('getArticleStatus', () => {
  it('retorna "Sem documentos" para count 0', () => {
    const status = getArticleStatus(0);
    expect(status.label).toBe('Sem documentos');
    expect(status.color).toContain('gray');
  });

  it('retorna "Inicial" para count 1-2', () => {
    expect(getArticleStatus(1).label).toBe('Inicial');
    expect(getArticleStatus(2).label).toBe('Inicial');
    expect(getArticleStatus(1).color).toContain('orange');
  });

  it('retorna "Medio" para count 3-5', () => {
    expect(getArticleStatus(3).label).toBe('Médio');
    expect(getArticleStatus(5).label).toBe('Médio');
    expect(getArticleStatus(3).color).toContain('blue');
  });

  it('retorna "Bom" para count 6-14', () => {
    expect(getArticleStatus(6).label).toBe('Bom');
    expect(getArticleStatus(10).label).toBe('Bom');
    expect(getArticleStatus(14).label).toBe('Bom');
    expect(getArticleStatus(10).color).toContain('green');
  });

  it('retorna "Excelente" para count >= 15', () => {
    expect(getArticleStatus(15).label).toBe('Excelente');
    expect(getArticleStatus(100).label).toBe('Excelente');
    expect(getArticleStatus(15).color).toContain('emerald');
  });

  it('inclui um icon component em cada nivel', () => {
    expect(getArticleStatus(0).icon).toBeDefined();
    expect(getArticleStatus(5).icon).toBeDefined();
    expect(getArticleStatus(20).icon).toBeDefined();
  });

  describe('variant editorial', () => {
    it('retorna "Órfão" para count 0 (vermelho)', () => {
      const s = getArticleStatus(0, 'editorial');
      expect(s.label).toBe('Órfão');
      expect(s.color).toContain('red');
    });

    it('retorna "Escasso" para count 1-2 (laranja)', () => {
      expect(getArticleStatus(1, 'editorial').label).toBe('Escasso');
      expect(getArticleStatus(2, 'editorial').label).toBe('Escasso');
    });

    it('mantem labels Medio/Bom/Excelente para counts >= 3', () => {
      expect(getArticleStatus(3, 'editorial').label).toBe('Médio');
      expect(getArticleStatus(10, 'editorial').label).toBe('Bom');
      expect(getArticleStatus(20, 'editorial').label).toBe('Excelente');
    });
  });
});
