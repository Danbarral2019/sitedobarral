import { describe, it, expect } from 'vitest';
import { groupActsByHierarchy } from '../grouping';

describe('groupActsByHierarchy', () => {
  it('agrupa por hierarchyLevel ascendente', () => {
    const acts = [
      { id: 'b', hierarchyLevel: 3 },
      { id: 'a', hierarchyLevel: 1 },
      { id: 'c', hierarchyLevel: 2 },
    ];
    const grouped = groupActsByHierarchy(acts);
    expect(grouped.map(([lvl]) => lvl)).toEqual([1, 2, 3]);
  });

  it('coloca acts do mesmo level no mesmo grupo', () => {
    const acts = [
      { id: 'a', hierarchyLevel: 1 },
      { id: 'b', hierarchyLevel: 1 },
      { id: 'c', hierarchyLevel: 2 },
    ];
    const grouped = groupActsByHierarchy(acts);
    expect(grouped[0][1]).toHaveLength(2);
    expect(grouped[1][1]).toHaveLength(1);
  });

  it('coloca acts sem hierarchyLevel no level=99 (final)', () => {
    const acts = [
      { id: 'a', hierarchyLevel: 1 },
      { id: 'b' },
      { id: 'c', hierarchyLevel: 2 },
    ];
    const grouped = groupActsByHierarchy(acts);
    expect(grouped[grouped.length - 1][0]).toBe(99);
    expect(grouped[grouped.length - 1][1][0]).toEqual({ id: 'b' });
  });

  it('preserva ordem de inserção dentro de cada grupo', () => {
    const acts = [
      { id: 'a', hierarchyLevel: 1 },
      { id: 'b', hierarchyLevel: 1 },
      { id: 'c', hierarchyLevel: 1 },
    ];
    const grouped = groupActsByHierarchy(acts);
    expect(grouped[0][1].map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('retorna array vazio pra entrada vazia', () => {
    expect(groupActsByHierarchy([])).toEqual([]);
  });
});
