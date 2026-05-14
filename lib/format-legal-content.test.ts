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

  describe('[...] → :omitido', () => {
    it('substitui [...] simples por marcador inline', () => {
      const input = 'Art. 1º [...] Parágrafo único.';
      const output = formatLegalContent(input);
      expect(output).toContain(':omitido');
      expect(output).not.toContain('[...]');
    });

    it('substitui [ ... ] com espaços', () => {
      const input = 'Art. 1º [ ... ] fim';
      const output = formatLegalContent(input);
      expect(output).toContain(':omitido');
    });

    it('substitui múltiplas ocorrências no mesmo parágrafo', () => {
      const input = 'Art. 1º [...] meio [...] fim';
      const output = formatLegalContent(input);
      expect(output.match(/:omitido/g)?.length).toBe(2);
    });
  });

  describe('(NR) preserva e marca', () => {
    it('envolve (NR) no fim de parágrafo em :nr[]', () => {
      const input = 'Parágrafo único. O disposto no art. 2º... (NR)';
      const output = formatLegalContent(input);
      expect(output).toContain(':nr[(NR)]');
    });

    it('NÃO envolve (NR) no meio de parágrafo', () => {
      const input = '(NR) é uma sigla. O texto continua.';
      const output = formatLegalContent(input);
      // (NR) no início não deve virar diretiva
      expect(output).not.toContain(':nr[(NR)]');
    });
  });
});
