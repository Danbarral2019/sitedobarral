// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { normalizeEmenta, stripArticlePrefix, isLikelyTruncated } from './parse-ementa';

describe('parse-ementa', () => {
  describe('stripArticlePrefix', () => {
    it('remove "Art. 1º "', () => {
      expect(stripArticlePrefix('Art. 1º Esta Lei estabelece...')).toBe(
        'Esta Lei estabelece...',
      );
    });

    it('remove "Art. 21º ." com ponto extra', () => {
      expect(stripArticlePrefix('Art. 21º . A Administração poderá')).toBe(
        'A Administração poderá',
      );
    });

    it('remove "Art. 179º " sem ponto', () => {
      expect(stripArticlePrefix('Art. 179º Os incisos II e III')).toBe(
        'Os incisos II e III',
      );
    });

    it('remove "Art. 75-A "', () => {
      expect(stripArticlePrefix('Art. 75-A texto')).toBe('texto');
    });
  });

  describe('normalizeEmenta — incisos romanos', () => {
    it('preserva incisos já formatados com \\n\\n', () => {
      const input = `caput texto:\n\nI - primeiro inciso;\n\nII - segundo inciso.`;
      const out = normalizeEmenta(input);
      expect(out).toContain('I — primeiro inciso');
      expect(out).toContain('II — segundo inciso');
      // não deve criar 3+ \n
      expect(out).not.toMatch(/\n{3,}/);
    });

    it('injeta \\n\\n quando inciso vem inline', () => {
      const input = `caput texto: I - primeiro; II - segundo.`;
      const out = normalizeEmenta(input);
      const paragraphs = out.split('\n\n');
      expect(paragraphs).toHaveLength(3);
      expect(paragraphs[0]).toContain('caput texto:');
      expect(paragraphs[1]).toMatch(/^I — primeiro/);
      expect(paragraphs[2]).toMatch(/^II — segundo/);
    });
  });

  describe('normalizeEmenta — Parágrafo único inline', () => {
    it('quebra linha antes de Parágrafo único colado no caput', () => {
      const input =
        'A Administração poderá convocar audiência pública. Parágrafo único. A Administração também poderá submeter consulta pública.';
      const out = normalizeEmenta(input);
      const paragraphs = out.split('\n\n');
      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0]).toBe(
        'A Administração poderá convocar audiência pública.',
      );
      expect(paragraphs[1]).toMatch(/^Parágrafo único\./);
    });

    it('não duplica quebra quando Parágrafo único já está no início de uma linha', () => {
      const input =
        'A Administração poderá convocar audiência pública.\n\nParágrafo único. A Administração também poderá submeter.';
      const out = normalizeEmenta(input);
      // deve continuar com exatamente uma quebra dupla
      expect(out.match(/\n\n/g)?.length).toBe(1);
    });
  });

  describe('normalizeEmenta — sufixo ALL CAPS de capítulo', () => {
    it('remove sufixo "DAS DEFINIÇÕES" ao final do art. 5º', () => {
      const input = `Lei de Introdução às Normas do Direito Brasileiro). DAS DEFINIÇÕES`;
      const out = normalizeEmenta(input);
      expect(out).not.toContain('DAS DEFINIÇÕES');
      expect(out).toMatch(/Direito Brasileiro\)\.$/);
    });

    it('remove sufixo "DOS PRINCÍPIOS" ao final', () => {
      const input = `aplicação dos limites previstos nos §§ 1º e 2º deste artigo. DOS PRINCÍPIOS`;
      const out = normalizeEmenta(input);
      expect(out).not.toContain('DOS PRINCÍPIOS');
    });

    it('remove sufixo composto "DAS IRREGULARIDADES DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS"', () => {
      const input = `critérios isonômicos, técnicos e transparentes. DAS IRREGULARIDADES DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS`;
      const out = normalizeEmenta(input);
      expect(out).not.toMatch(/IRREGULARIDADES|INFRAÇÕES|SANÇÕES/);
      expect(out).toMatch(/transparentes\.$/);
    });

    it('preserva texto legítimo em maiúscula que não é sufixo de capítulo', () => {
      const input = `texto normal com sigla TCU referenciada.`;
      const out = normalizeEmenta(input);
      expect(out).toContain('TCU');
    });

    it('preserva ALL CAPS curto sem prefixo DA/DO no final (ex: "(VETADO)")', () => {
      const input = `§ 3º (VETADO).`;
      const out = normalizeEmenta(input);
      expect(out).toContain('(VETADO)');
    });
  });

  describe('isLikelyTruncated', () => {
    it('detecta texto terminando em "do"', () => {
      const text = 'a'.repeat(60) + ' do';
      expect(isLikelyTruncated(text)).toBe(true);
    });

    it('texto bem-formado não é considerado truncado', () => {
      expect(isLikelyTruncated('Texto completo terminado com ponto final.')).toBe(false);
    });
  });
  describe('marcadores de tramitação', () => {
    it('remove "(Vide Decreto ...)" e o "Vigência" que vem colado', () => {
      const raw =
        'I - para contratação que envolva valores inferiores a R$ 100.000,00 ' +
        '(cem mil reais);        (Vide Decreto nº 10.922, de 2021)      (Vigência)      ' +
        '(Vide Decreto nº 12.343, de 2024)    Vigência';
      const out = normalizeEmenta(raw);
      expect(out).not.toContain('Vide Decreto');
      expect(out).not.toContain('Vigência');
      expect(out).toContain('R$ 100.000,00 (cem mil reais);');
    });

    it('remove "(Redação dada ...)" e "(Incluído ...)"', () => {
      const raw = 'XVII - texto do inciso; (Redação dada pela Lei nº 14.628, de 2023) (Incluído pela Medida Provisória nº 1.166, de 2023)';
      const out = normalizeEmenta(raw);
      expect(out).not.toContain('Redação dada');
      expect(out).not.toContain('Incluído pela');
      expect(out).toContain('texto do inciso;');
    });

    it('preserva (VETADO), que é texto oficial', () => {
      const out = normalizeEmenta('Art. 1º Isto é (VETADO) parte do texto.');
      expect(out).toContain('(VETADO)');
    });
  });
});
