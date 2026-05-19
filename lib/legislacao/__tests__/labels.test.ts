import { describe, it, expect } from 'vitest';
import {
  getTypeLabel,
  getTypeColor,
  getEsferaLabel,
  formatLegislativeDate,
  isValidSort,
} from '../labels';

describe('getTypeLabel', () => {
  it('retorna label conhecido', () => {
    expect(getTypeLabel('decreto')).toBe('Decreto');
    expect(getTypeLabel('lei')).toBe('Lei');
    expect(getTypeLabel('boa_pratica')).toBe('Outro Ato Normativo');
  });

  it('retorna o input pra tipo desconhecido', () => {
    expect(getTypeLabel('inexistente')).toBe('inexistente');
  });
});

describe('getTypeColor', () => {
  it('retorna classes especificas pra tipos conhecidos', () => {
    expect(getTypeColor('decreto')).toContain('blue');
    expect(getTypeColor('lei')).toContain('red');
  });

  it('retorna cinza pra tipo desconhecido', () => {
    expect(getTypeColor('xyz')).toContain('gray');
  });
});

describe('getEsferaLabel', () => {
  it('retorna labels conhecidos', () => {
    expect(getEsferaLabel('federal')).toBe('Federal');
    expect(getEsferaLabel('estadual')).toBe('Estadual');
  });

  it('retorna input pra esfera desconhecida', () => {
    expect(getEsferaLabel('municipal')).toBe('municipal');
  });
});

describe('formatLegislativeDate', () => {
  it('formata data em pt-BR com mes por extenso', () => {
    const result = formatLegislativeDate('2024-03-15T10:00:00Z');
    expect(result).toMatch(/\d{2}/);
    expect(result).toContain('2024');
  });
});

describe('isValidSort', () => {
  it('aceita valores validos', () => {
    expect(isValidSort('recent')).toBe(true);
    expect(isValidSort('oldest')).toBe(true);
    expect(isValidSort('hierarchy')).toBe(true);
    expect(isValidSort('number')).toBe(true);
    expect(isValidSort('alpha')).toBe(true);
  });

  it('rejeita invalidos', () => {
    expect(isValidSort('random')).toBe(false);
    expect(isValidSort('')).toBe(false);
    expect(isValidSort(null)).toBe(false);
    expect(isValidSort(undefined)).toBe(false);
  });
});
