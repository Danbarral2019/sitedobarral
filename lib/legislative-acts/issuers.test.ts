// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  normalizeIssuer,
  isCanonicalIssuer,
  assertCanonicalIssuer,
  CANONICAL_ISSUERS,
} from './issuers';

describe('normalizeIssuer', () => {
  describe('Presidência', () => {
    it('mantém "Presidência da República"', () => {
      expect(normalizeIssuer('Presidência da República')).toBe('Presidência da República');
    });
    it('"Presidência" → "Presidência da República"', () => {
      expect(normalizeIssuer('Presidência')).toBe('Presidência da República');
    });
    it('"Presidencia" (sem acento) → "Presidência da República"', () => {
      expect(normalizeIssuer('Presidencia')).toBe('Presidência da República');
    });
    it('"PR" → "Presidência da República"', () => {
      expect(normalizeIssuer('PR')).toBe('Presidência da República');
    });
  });

  describe('SEGES', () => {
    it('mantém "SEGES"', () => {
      expect(normalizeIssuer('SEGES')).toBe('SEGES');
    });
    it('"SEGES/MGI" → "SEGES"', () => {
      expect(normalizeIssuer('SEGES/MGI')).toBe('SEGES');
    });
    it('"SEGES/ME" → "SEGES"', () => {
      expect(normalizeIssuer('SEGES/ME')).toBe('SEGES');
    });
    it('"AUTOR/ME" → "SEGES"', () => {
      expect(normalizeIssuer('AUTOR/ME')).toBe('SEGES');
    });
    it('"ME" → "SEGES"', () => {
      expect(normalizeIssuer('ME')).toBe('SEGES');
    });
    it('"SESGES" (typo) → "SEGES"', () => {
      expect(normalizeIssuer('SESGES')).toBe('SEGES');
    });
  });

  describe('MPOG (preservação histórica)', () => {
    it('"MP" → "MPOG"', () => {
      expect(normalizeIssuer('MP')).toBe('MPOG');
    });
    it('mantém "MPOG"', () => {
      expect(normalizeIssuer('MPOG')).toBe('MPOG');
    });
    it('"Ministério do Planejamento" → "MPOG"', () => {
      expect(normalizeIssuer('Ministério do Planejamento')).toBe('MPOG');
    });
  });

  describe('outros órgãos (não consolidam)', () => {
    it('"SGD/MGI" mantém-se separado de SEGES', () => {
      expect(normalizeIssuer('SGD/MGI')).toBe('SGD/MGI');
    });
    it('"SGD" → "SGD/MGI"', () => {
      expect(normalizeIssuer('SGD')).toBe('SGD/MGI');
    });
    it('TCU, MPU, CICS/MGI, CIIA-PAC/CC passam direto', () => {
      expect(normalizeIssuer('TCU')).toBe('TCU');
      expect(normalizeIssuer('MPU')).toBe('MPU');
      expect(normalizeIssuer('CICS/MGI')).toBe('CICS/MGI');
      expect(normalizeIssuer('CIIA-PAC/CC')).toBe('CIIA-PAC/CC');
    });
  });

  describe('whitespace e case', () => {
    it('aceita espaços ao redor', () => {
      expect(normalizeIssuer('  SEGES/MGI  ')).toBe('SEGES');
    });
    it('case-insensitive como fallback', () => {
      expect(normalizeIssuer('seges/mgi')).toBe('SEGES');
      expect(normalizeIssuer('PRESIDÊNCIA')).toBe('Presidência da República');
    });
  });

  describe('issuer desconhecido', () => {
    it('lança erro com mensagem instrutiva', () => {
      expect(() => normalizeIssuer('Foo Bar')).toThrow(/Issuer desconhecido/);
      expect(() => normalizeIssuer('Foo Bar')).toThrow(/SEGES[\s\S]*MPOG/);
    });
    it('lança erro pra string vazia', () => {
      expect(() => normalizeIssuer('')).toThrow(/Issuer desconhecido/);
    });
  });
});

describe('isCanonicalIssuer', () => {
  it('aceita valores da lista', () => {
    expect(isCanonicalIssuer('SEGES')).toBe(true);
    expect(isCanonicalIssuer('Presidência da República')).toBe(true);
    expect(isCanonicalIssuer('MPOG')).toBe(true);
  });
  it('rejeita aliases', () => {
    expect(isCanonicalIssuer('SEGES/MGI')).toBe(false);
    expect(isCanonicalIssuer('Presidência')).toBe(false);
    expect(isCanonicalIssuer('MP')).toBe(false);
  });
  it('rejeita valor desconhecido', () => {
    expect(isCanonicalIssuer('Foo')).toBe(false);
  });
});

describe('assertCanonicalIssuer', () => {
  it('passa silencioso pra valor canônico', () => {
    expect(() => assertCanonicalIssuer('SEGES')).not.toThrow();
  });
  it('lança erro pra alias', () => {
    expect(() => assertCanonicalIssuer('SEGES/MGI')).toThrow(/não é canônico/);
  });
});

describe('CANONICAL_ISSUERS', () => {
  it('contém os 9 órgãos esperados', () => {
    expect(CANONICAL_ISSUERS).toHaveLength(9);
    expect(CANONICAL_ISSUERS).toContain('SEGES');
    expect(CANONICAL_ISSUERS).toContain('MPOG');
    expect(CANONICAL_ISSUERS).toContain('MF');
    expect(CANONICAL_ISSUERS).toContain('Presidência da República');
    expect(CANONICAL_ISSUERS).toContain('SGD/MGI');
  });
});

describe('MF (Ministério da Fazenda)', () => {
  it('mantém "MF"', () => {
    expect(normalizeIssuer('MF')).toBe('MF');
  });
  it('"Ministério da Fazenda" → "MF"', () => {
    expect(normalizeIssuer('Ministério da Fazenda')).toBe('MF');
  });
});
