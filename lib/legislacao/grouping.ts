/**
 * Agrupamento de atos por nivel hierarquico (vista pedagogica).
 *
 * Atos sem hierarchyLevel definido vao pro level=99 (fim da lista).
 */

export interface ActWithHierarchy {
  hierarchyLevel?: number;
}

export function groupActsByHierarchy<T extends ActWithHierarchy>(acts: T[]): Array<[number, T[]]> {
  const map = new Map<number, T[]>();
  for (const a of acts) {
    const lvl = a.hierarchyLevel ?? 99;
    if (!map.has(lvl)) map.set(lvl, []);
    map.get(lvl)!.push(a);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}
