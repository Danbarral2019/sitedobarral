// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  computeHash,
  normalizeContent,
  detectChanges,
  hasHashChanged,
  generateChangeSummary,
} from '../change-detector';

describe('normalizeContent', () => {
  it('colapsa espaços e apara extremidades', () => {
    expect(normalizeContent('  a   b  ')).toBe('a b');
  });

  it('normaliza aspas curvas, travessões e nbsp', () => {
    expect(normalizeContent('“a”—b c')).toBe('"a"-b c');
  });
});

describe('computeHash', () => {
  it('é estável para conteúdos que normalizam igual', () => {
    expect(computeHash('a  b')).toBe(computeHash('a b'));
  });

  it('difere para conteúdos distintos', () => {
    expect(computeHash('abc')).not.toBe(computeHash('xyz'));
  });
});

describe('detectChanges', () => {
  it('marca mudança quando não há conteúdo anterior', () => {
    const r = detectChanges(null, 'novo');
    expect(r.hasChanged).toBe(true);
    expect(r.oldHash).toBeNull();
  });

  it('não marca mudança quando o conteúdo normaliza igual', () => {
    expect(detectChanges('a  b', 'a b').hasChanged).toBe(false);
  });

  it('marca mudança e calcula similaridade (0-100) quando difere', () => {
    const r = detectChanges('o rato roeu a roupa', 'o gato comeu a comida');
    expect(r.hasChanged).toBe(true);
    expect(r.similarity).toBeGreaterThanOrEqual(0);
    expect(r.similarity).toBeLessThanOrEqual(100);
  });
});

describe('hasHashChanged', () => {
  it('true quando não há hash anterior', () => {
    expect(hasHashChanged(null, 'x')).toBe(true);
    expect(hasHashChanged(undefined, 'x')).toBe(true);
  });

  it('false quando iguais, true quando diferentes', () => {
    expect(hasHashChanged('abc', 'abc')).toBe(false);
    expect(hasHashChanged('abc', 'def')).toBe(true);
  });
});

describe('generateChangeSummary', () => {
  it('resume adição de caracteres e inclui a similaridade', () => {
    const s = generateChangeSummary('abc', 'abcdef');
    expect(s).toContain('caracteres adicionados');
    expect(s).toMatch(/similaridade/);
  });

  it('classifica como alteração significativa quando a similaridade é baixa', () => {
    expect(generateChangeSummary('aaa bbb ccc', 'xxx yyy zzz')).toContain('significativa');
  });
});
