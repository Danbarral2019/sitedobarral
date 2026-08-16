/**
 * Testes para lib/admin/tribunal-decisions/format.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  relativeTime,
  tribunalColor,
  parseJsonArray,
  getRelevanceColor,
  getApprovalStatusColor,
  getHealthBadgeKind,
} from '../format';

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna "Nunca" para null', () => {
    expect(relativeTime(null)).toBe('Nunca');
  });

  it('retorna "Agora" para diff < 1 min', () => {
    expect(relativeTime(new Date('2026-05-19T11:59:30Z').toISOString())).toBe('Agora');
  });

  it('retorna minutos para diff < 1h', () => {
    expect(relativeTime(new Date('2026-05-19T11:30:00Z').toISOString())).toBe('30min atras');
  });

  it('retorna horas para diff < 24h', () => {
    expect(relativeTime(new Date('2026-05-19T07:00:00Z').toISOString())).toBe('5h atras');
  });

  it('retorna dias para diff < 30d', () => {
    expect(relativeTime(new Date('2026-05-12T12:00:00Z').toISOString())).toBe('7d atras');
  });

  it('retorna data local para diff >= 30d', () => {
    const result = relativeTime(new Date('2026-01-01T12:00:00Z').toISOString());
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

describe('tribunalColor', () => {
  it('retorna classes especificas pra tribunais conhecidos', () => {
    expect(tribunalColor('TCE-SP')).toContain('blue');
    expect(tribunalColor('TCU')).toContain('red');
    expect(tribunalColor('TCE-MG')).toContain('green');
    expect(tribunalColor('TCE-RS')).toContain('violet');
  });

  it('retorna cinza pra tribunal desconhecido', () => {
    expect(tribunalColor('TCE-XX')).toContain('gray');
    expect(tribunalColor('')).toContain('gray');
  });

  it('dá cor própria ao STF', () => {
    expect(tribunalColor('STF')).toContain('amber');
  });
});

describe('parseJsonArray', () => {
  it('retorna [] para null', () => {
    expect(parseJsonArray(null)).toEqual([]);
  });

  it('parseia JSON array valido', () => {
    expect(parseJsonArray('["a","b","c"]')).toEqual(['a', 'b', 'c']);
  });

  it('retorna [] em JSON invalido', () => {
    expect(parseJsonArray('not json')).toEqual([]);
  });

  it('retorna [] para string vazia', () => {
    expect(parseJsonArray('')).toEqual([]);
  });
});

describe('getRelevanceColor', () => {
  it('retorna verde pra score >= 80', () => {
    expect(getRelevanceColor(80)).toContain('green');
    expect(getRelevanceColor(100)).toContain('green');
  });

  it('retorna amarelo pra score 50-79', () => {
    expect(getRelevanceColor(50)).toContain('yellow');
    expect(getRelevanceColor(79)).toContain('yellow');
  });

  it('retorna cinza pra score < 50', () => {
    expect(getRelevanceColor(0)).toContain('gray');
    expect(getRelevanceColor(49)).toContain('gray');
  });
});

describe('getApprovalStatusColor', () => {
  it('retorna amarelo para "pending"', () => {
    expect(getApprovalStatusColor('pending')).toContain('yellow');
  });

  it('retorna verde para status incluindo "approved"', () => {
    expect(getApprovalStatusColor('auto_approved')).toContain('green');
    expect(getApprovalStatusColor('manually_approved')).toContain('green');
  });

  it('retorna vermelho pra rejected', () => {
    expect(getApprovalStatusColor('auto_rejected')).toContain('red');
    expect(getApprovalStatusColor('manually_rejected')).toContain('red');
  });
});

describe('getHealthBadgeKind', () => {
  it('retorna ok quando healthy e 0 falhas', () => {
    const r = getHealthBadgeKind(true, 0);
    expect(r.label).toBe('ok');
    expect(r.color).toContain('green');
  });

  it('retorna warning quando healthy mas com falhas', () => {
    const r = getHealthBadgeKind(true, 2);
    expect(r.label).toBe('warning');
    expect(r.color).toContain('yellow');
  });

  it('retorna error quando nao healthy', () => {
    const r = getHealthBadgeKind(false, 5);
    expect(r.label).toBe('error');
    expect(r.color).toContain('red');
  });
});
