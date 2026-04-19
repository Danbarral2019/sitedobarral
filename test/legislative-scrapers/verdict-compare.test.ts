// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { computeVerdictByCompare } from '../../scripts/audit-helpers';

describe('computeVerdictByCompare', () => {
  describe('truncated', () => {
    it('stored << fresh (ratio bem abaixo de 0.6)', () => {
      expect(computeVerdictByCompare(826, 25826)).toBe('truncated');
    });

    it('stored exatamente no limite (ratio = 0.59)', () => {
      expect(computeVerdictByCompare(59, 100)).toBe('truncated');
    });

    it('stored === 0 e fresh > 0', () => {
      expect(computeVerdictByCompare(0, 5000)).toBe('truncated');
    });

    it('fresh === 0 e stored > 0 (anomalia, scraper fresco falhou silenciosamente)', () => {
      expect(computeVerdictByCompare(5000, 0)).toBe('truncated');
    });
  });

  describe('bloated', () => {
    it('stored >> fresh (ratio bem acima de 1.4)', () => {
      expect(computeVerdictByCompare(15000, 5000)).toBe('bloated');
    });

    it('stored exatamente acima do limite (ratio = 1.41)', () => {
      expect(computeVerdictByCompare(141, 100)).toBe('bloated');
    });

    it('stored tem ruído que scraper atual remove', () => {
      expect(computeVerdictByCompare(10000, 6000)).toBe('bloated');
    });
  });

  describe('ok', () => {
    it('stored === fresh (ratio 1.0)', () => {
      expect(computeVerdictByCompare(5000, 5000)).toBe('ok');
    });

    it('stored ligeiramente menor (ratio 0.8)', () => {
      expect(computeVerdictByCompare(4000, 5000)).toBe('ok');
    });

    it('stored ligeiramente maior (ratio 1.2)', () => {
      expect(computeVerdictByCompare(6000, 5000)).toBe('ok');
    });

    it('stored no limite inferior (ratio 0.6 exato)', () => {
      expect(computeVerdictByCompare(60, 100)).toBe('ok');
    });

    it('stored no limite superior (ratio 1.4 exato)', () => {
      expect(computeVerdictByCompare(140, 100)).toBe('ok');
    });

    it('ambos vazios', () => {
      expect(computeVerdictByCompare(0, 0)).toBe('ok');
    });
  });
});
