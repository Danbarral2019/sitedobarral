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

  describe('aspas curvas → :::alteracao', () => {
    it('envolve bloco de aspas em um único parágrafo', () => {
      const input = 'Art. 1º\n\nO Decreto X passa a vigorar:\n\n“Art. 1º novo texto.” (NR)';
      const output = formatLegalContent(input);
      expect(output).toContain(':::alteracao');
      expect(output).toContain(':::');
    });

    it('envolve aspas atravessando múltiplos parágrafos', () => {
      const input = [
        'Texto base.',
        '',
        '“Art. 1º começo do bloco',
        '',
        'Parágrafo único. Continua.',
        '',
        'Mais texto fechamento.” (NR)',
        '',
        'Depois do bloco.',
      ].join('\n');
      const output = formatLegalContent(input);
      expect(output).toContain(':::alteracao');
      // O parágrafo "Mais texto fechamento" deve estar dentro do bloco
      const blockMatch = output.match(/:::alteracao([\s\S]*?):::/);
      expect(blockMatch).toBeTruthy();
      expect(blockMatch![1]).toContain('Mais texto fechamento');
      expect(blockMatch![1]).toContain('Parágrafo único');
    });

    it('aspas aninhadas: balanceamento de contador', () => {
      const input = '“externo “interno” externo continua.” (NR)';
      const output = formatLegalContent(input);
      const blocos = output.match(/:::alteracao/g);
      expect(blocos?.length).toBe(1);
    });

    it('aspa abrindo sem fechar: fail-safe (não cria bloco)', () => {
      const input = '“texto sem fechamento até o fim do ato';
      const output = formatLegalContent(input);
      expect(output).not.toContain(':::alteracao');
      // Mas o conteúdo permanece
      expect(output).toContain('texto sem fechamento');
    });
  });
});
