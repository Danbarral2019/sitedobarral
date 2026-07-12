// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { formatLegalContent } from '../format-legal-content';

describe('formatLegalContent', () => {
  it('extrai o título oficial como H1 e remove o cabeçalho institucional', () => {
    const raw = [
      'Presidência da República',
      'Casa Civil',
      'Subchefia para Assuntos Jurídicos',
      'DECRETO Nº 12.807, DE 2025',
      'Dispõe sobre valores.',
    ].join('\n');
    const out = formatLegalContent(raw);
    expect(out.startsWith('# DECRETO Nº 12.807, DE 2025')).toBe(true);
    expect(out).not.toContain('Presidência da República');
    expect(out).not.toContain('Casa Civil');
  });

  it('formata cabeçalhos estruturais (CAPÍTULO, SEÇÃO, SUBSEÇÃO) com níveis de heading', () => {
    // Isolados: quando seguidos por outra linha, o merge pode agrupá-los
    // (ex.: "CAPÍTULO I" termina em letra única e atrai a linha seguinte).
    expect(formatLegalContent('CAPÍTULO I')).toContain('## CAPÍTULO I');
    expect(formatLegalContent('SEÇÃO II')).toContain('### SEÇÃO II');
    expect(formatLegalContent('SUBSEÇÃO III')).toContain('#### SUBSEÇÃO III');
  });

  it('emboldena artigos e parágrafos (Art., §, Parágrafo único)', () => {
    const raw = 'Art. 1º Este é o artigo.\n\n§ 2º Este é o parágrafo.\n\nParágrafo único. Texto.';
    const out = formatLegalContent(raw);
    expect(out).toContain('**Art. 1º**');
    expect(out).toContain('**§ 2º**');
    expect(out).toMatch(/\*\*Parágrafo único\.?\*\*/);
  });

  it('converte os marcadores DECRETA/RESOLVE em separador em negrito', () => {
    expect(formatLegalContent('DECRETA:')).toContain('**DECRETA:**');
    expect(formatLegalContent('RESOLVE:')).toContain('**RESOLVE:**');
  });

  it('aplica transformações inline: caput em itálico, [...] omitido e (NR)', () => {
    const raw = 'Art. 1º O caput deste artigo [...] entra em vigor. (NR)';
    const out = formatLegalContent(raw);
    expect(out).toContain('*caput*');
    expect(out).toContain(':omitido');
    expect(out).toContain(':nr[(NR)]');
  });

  it('trata o rodapé do DOU como blockquote em itálico', () => {
    const out = formatLegalContent('Art. 1º Texto.\n\nEste texto não substitui o publicado no DOU de 1.1.2025');
    expect(out).toContain('> *Este texto não substitui');
  });

  it('envolve a zona de assinatura em :::signature', () => {
    const raw = 'Art. 1º Texto.\n\nBrasília, 1º de janeiro de 2025.\n\nFULANO DE TAL';
    const out = formatLegalContent(raw);
    expect(out).toContain(':::signature');
    expect(out).toContain('Brasília, 1º de janeiro de 2025.');
  });

  it('devolve o conteúdo sem título quando não há título oficial reconhecível', () => {
    const out = formatLegalContent('Um texto qualquer sem cabeçalho oficial.');
    expect(out.startsWith('#')).toBe(false);
    expect(out).toContain('Um texto qualquer');
  });
});
