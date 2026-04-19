// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { normalizeThemeTic } from '../../scripts/normalize-theme-tic';

describe('normalizeThemeTic', () => {
  it('é no-op quando não há tic', () => {
    expect(normalizeThemeTic(['planejamento', 'contratos'])).toEqual(['planejamento', 'contratos']);
  });

  it('substitui tic por tecnologia-informacao', () => {
    expect(normalizeThemeTic(['tic'])).toEqual(['tecnologia-informacao']);
  });

  it('preserva ordem dos outros temas ao substituir tic', () => {
    expect(normalizeThemeTic(['planejamento', 'tic', 'contratos']))
      .toEqual(['planejamento', 'tecnologia-informacao', 'contratos']);
  });

  it('deduplica quando tic e tecnologia-informacao coexistem', () => {
    expect(normalizeThemeTic(['tic', 'tecnologia-informacao']))
      .toEqual(['tecnologia-informacao']);
    expect(normalizeThemeTic(['tecnologia-informacao', 'tic']))
      .toEqual(['tecnologia-informacao']);
  });

  it('deduplica mesmo quando tic aparece múltiplas vezes', () => {
    expect(normalizeThemeTic(['tic', 'planejamento', 'tic']))
      .toEqual(['tecnologia-informacao', 'planejamento']);
  });
});
