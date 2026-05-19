import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DOU_FILTERS,
  DOU_SECTIONS,
  DOU_DATE_PRESETS,
  computeIsAllSelected,
} from '../defaults';

describe('DEFAULT_DOU_FILTERS', () => {
  it('tem maxResults default = 50', () => {
    expect(DEFAULT_DOU_FILTERS.maxResults).toBe(50);
  });

  it('tem searchTerm "licitação OR pregão" default', () => {
    expect(DEFAULT_DOU_FILTERS.searchTerm).toBe('licitação OR pregão');
  });

  it('tem sections vazio', () => {
    expect(DEFAULT_DOU_FILTERS.sections).toEqual([]);
  });
});

describe('DOU_SECTIONS', () => {
  it('tem 4 secoes', () => {
    expect(DOU_SECTIONS).toHaveLength(4);
  });

  it('inclui do1, do2, do3, doe', () => {
    const values = DOU_SECTIONS.map((s) => s.value);
    expect(values).toEqual(['do1', 'do2', 'do3', 'doe']);
  });
});

describe('DOU_DATE_PRESETS', () => {
  it('tem 6 presets incluindo custom', () => {
    expect(DOU_DATE_PRESETS).toHaveLength(6);
    expect(DOU_DATE_PRESETS[DOU_DATE_PRESETS.length - 1].value).toBe('custom');
  });
});

describe('computeIsAllSelected', () => {
  it('retorna true quando todos os items estao selecionados', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(computeIsAllSelected(items, new Set(['a', 'b']))).toBe(true);
  });

  it('retorna false quando algum nao esta selecionado', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(computeIsAllSelected(items, new Set(['a']))).toBe(false);
  });

  it('retorna false para items vazio', () => {
    expect(computeIsAllSelected([], new Set())).toBe(false);
    expect(computeIsAllSelected([], new Set(['x']))).toBe(false);
  });

  it('retorna false quando selectedIds tem ids fora dos items', () => {
    const items = [{ id: 'a' }];
    expect(computeIsAllSelected(items, new Set(['b']))).toBe(false);
  });
});
