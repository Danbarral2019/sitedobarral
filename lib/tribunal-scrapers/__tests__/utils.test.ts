// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { normalizeTribunalCode, buildFullIdentifier } from '../utils';

describe('normalizeTribunalCode', () => {
  it('força UPPERCASE (forma canônica do tribunalCode no DB)', () => {
    expect(normalizeTribunalCode('tce-pe')).toBe('TCE-PE');
    expect(normalizeTribunalCode('stj')).toBe('STJ');
    expect(normalizeTribunalCode('tcu')).toBe('TCU');
  });

  it('é idempotente para códigos já maiúsculos', () => {
    expect(normalizeTribunalCode('TCE-RS')).toBe('TCE-RS');
  });

  it('apara espaços', () => {
    expect(normalizeTribunalCode('  tce-sp  ')).toBe('TCE-SP');
  });
});

describe('buildFullIdentifier', () => {
  it('usa o tribunalCode normalizado (case-estável) no identificador', () => {
    // Mesmo identificador independentemente do case do código de entrada —
    // garante dedup estável entre decisões legadas e novas.
    const lower = buildFullIdentifier('tce-pe', 'acordao', '698/2026');
    const upper = buildFullIdentifier('TCE-PE', 'acordao', '698/2026');
    expect(lower).toBe(upper);
    expect(lower).toContain('TCE-PE');
  });
});
