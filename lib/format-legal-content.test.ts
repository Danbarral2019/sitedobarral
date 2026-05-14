import { describe, it, expect } from 'vitest';
import { formatLegalContent } from './format-legal-content';

describe('formatLegalContent', () => {
  describe('caput em itálico', () => {
    it('italiciza caput entre vírgulas', () => {
      const input = 'art. 84, caput, inciso IV, da Constituição';
      const output = formatLegalContent(input);
      expect(output).toContain('*caput*');
    });

    it('italiciza caput seguido de espaço', () => {
      const input = 'previsto no caput deste artigo';
      const output = formatLegalContent(input);
      expect(output).toContain('*caput*');
    });

    it('NÃO italiciza caput dentro de outra palavra (word boundary)', () => {
      const input = 'isto é capturar dados, não capitular';
      const output = formatLegalContent(input);
      expect(output).not.toContain('*capt*urar');
      expect(output).not.toContain('*capt*ular');
      expect(output).toContain('capturar');
      expect(output).toContain('capitular');
    });
  });
});
