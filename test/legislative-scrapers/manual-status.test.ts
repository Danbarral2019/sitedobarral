// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { filterSuspiciousExcludingManual } from '../../scripts/audit-helpers';

describe('filterSuspiciousExcludingManual', () => {
  it('inclui atos com verdict truncated e sem status manual', () => {
    const spotCheck = [
      { id: 'a', verdict: 'truncated' },
      { id: 'b', verdict: 'ok' },
    ];
    const manualIds = new Set<string>();
    expect(filterSuspiciousExcludingManual(spotCheck, manualIds)).toEqual(['a']);
  });

  it('inclui atos com verdict bloated e sem status manual', () => {
    const spotCheck = [
      { id: 'a', verdict: 'bloated' },
    ];
    const manualIds = new Set<string>();
    expect(filterSuspiciousExcludingManual(spotCheck, manualIds)).toEqual(['a']);
  });

  it('exclui atos cujo id está em manualIds, mesmo com verdict truncated/bloated', () => {
    const spotCheck = [
      { id: 'tcu-1', verdict: 'bloated' },
      { id: 'tcu-2', verdict: 'bloated' },
      { id: 'seges-1', verdict: 'truncated' },
    ];
    const manualIds = new Set(['tcu-1', 'tcu-2']);
    expect(filterSuspiciousExcludingManual(spotCheck, manualIds)).toEqual(['seges-1']);
  });

  it('ignora verdicts ok/url-dead/skipped', () => {
    const spotCheck = [
      { id: 'a', verdict: 'ok' },
      { id: 'b', verdict: 'url-dead' },
      { id: 'c', verdict: 'skipped' },
      { id: 'd', verdict: 'truncated' },
    ];
    const manualIds = new Set<string>();
    expect(filterSuspiciousExcludingManual(spotCheck, manualIds)).toEqual(['d']);
  });

  it('retorna lista vazia quando não há spotCheck suspicious', () => {
    expect(filterSuspiciousExcludingManual([], new Set())).toEqual([]);
  });
});
