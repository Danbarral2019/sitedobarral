// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { validateActContent } from '../../lib/legislative-scrapers/validate-content';

const VALID_CONTENT = `INSTRUÇÃO NORMATIVA Nº 5, DE 26 DE MAIO DE 2017 (Atualizada)

Dispõe sobre as regras e diretrizes do procedimento de contratação de serviços.

O SECRETÁRIO DE GESTÃO DO MINISTÉRIO DO PLANEJAMENTO, no uso das atribuições que lhe confere o Decreto nº 9.035, de 20 de abril de 2017, considerando o disposto na Lei nº 8.666, de 21 de junho de 1993, resolve:

CAPÍTULO I
DISPOSIÇÕES GERAIS

Art. 1º As contratações de serviços observarão, no que couber:
I - as fases de Planejamento, Seleção e Gestão;
II - os critérios e práticas de sustentabilidade.

Art. 2º Para os efeitos desta Instrução Normativa são adotadas as definições constantes do Anexo I.`;

const VALID_BIG = VALID_CONTENT.repeat(3);

describe('validateActContent — checks de formatação no content', () => {
  it('bloqueia content com mojibake U+FFFD', () => {
    const result = validateActContent({
      content: VALID_BIG + 'Disp�e sobre a aliena��o',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/U\+FFFD|charset/i);
  });

  it('warns com NBSP (U+00A0) residual no content', () => {
    const result = validateActContent({
      content: VALID_BIG + 'Art. 1º texto',
    });
    expect(result.warnings.join(' ')).toMatch(/NBSP/);
  });

  it('warns com zero-width residual', () => {
    const result = validateActContent({
      content: VALID_BIG + 'Dimens​ionamento',
    });
    expect(result.warnings.join(' ')).toMatch(/zero-width/);
  });

  it('warns com "Este texto não substitui" duplicado', () => {
    const dup = 'Este texto não substitui o publicado no DOU.';
    const result = validateActContent({
      content: VALID_BIG + '\n\n' + dup + '\n\nAnexo.\n\n' + dup,
    });
    expect(result.warnings.join(' ')).toMatch(/Este texto não substitui.*2/);
  });

  it('warns com HTML entities residuais', () => {
    const result = validateActContent({
      content: VALID_BIG + '\n\n&nbsp; texto com &amp; entidade',
    });
    expect(result.warnings.join(' ')).toMatch(/HTML entities/);
  });

  it('warns com tags HTML canônicas (br/p/div/span)', () => {
    const result = validateActContent({
      content: VALID_BIG + '<br/><p>Texto</p>',
    });
    expect(result.warnings.join(' ')).toMatch(/tags HTML/);
  });

  it('NÃO confunde placeholders <campo> com tags HTML', () => {
    const result = validateActContent({
      content: VALID_BIG + '<nº do processo> e <Qtde de meses>',
    });
    expect(result.warnings.join(' ')).not.toMatch(/tags HTML/);
  });

  it('NÃO confunde expressões matemáticas tipo "< 95%" com tags', () => {
    const result = validateActContent({
      content: VALID_BIG + '< 95%: Glosa de 1,5% sobre o valor da OS;',
    });
    expect(result.warnings.join(' ')).not.toMatch(/tags HTML/);
  });

  it('warns com bloco "Publicado em.../Modificado em..." inline', () => {
    const result = validateActContent({
      content: VALID_BIG + 'Publicado em 05/11/2025 09:54Modificado em 12/11/2025 16:48Compartilhe:',
    });
    expect(result.warnings.join(' ')).toMatch(/Publicado em.*Modificado em/);
  });
});

describe('validateActContent — checks de formatação na ementa', () => {
  it('bloqueia ementa vazia', () => {
    const result = validateActContent({
      content: VALID_BIG,
      ementa: '',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Ementa vazia/);
  });

  it('bloqueia ementa com mojibake', () => {
    const result = validateActContent({
      content: VALID_BIG,
      ementa: 'Disp�e sobre a aliena��o de bens.',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Ementa.*U\+FFFD/);
  });

  it('bloqueia ementa que começa com "Art. X" (fragmento do body)', () => {
    const result = validateActContent({
      content: VALID_BIG,
      ementa: 'Art. 14. Ao final de cada ano deverá ser elaborado relatório.',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Art\. X|fragmento/);
  });

  it('bloqueia ementa com apenas header institucional', () => {
    const result = validateActContent({
      content: VALID_BIG,
      ementa: 'Presidência',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/header institucional/);
  });

  it('bloqueia ementa que começa em meio de frase', () => {
    const result = validateActContent({
      content: VALID_BIG,
      ementa: '8.660, de 29 de janeiro de 2016, ou de outro que venha a substituí-lo.',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/meio de frase|fragmento/);
  });

  it('warns com ementa muito curta (< 25 chars)', () => {
    const result = validateActContent({
      content: VALID_BIG,
      ementa: 'Lei sobre X.',
    });
    expect(result.warnings.join(' ')).toMatch(/curta/);
  });

  it('aceita ementa válida', () => {
    const result = validateActContent({
      content: VALID_BIG,
      ementa: 'Dispõe sobre a proteção de dados pessoais e altera a Lei nº 12.965, de 23 de abril de 2014.',
    });
    expect(result.errors.filter((e) => e.toLowerCase().includes('ementa'))).toEqual([]);
  });

  it('é no-op quando ementa não é passada (compat com callers existentes)', () => {
    const result = validateActContent({
      content: VALID_BIG,
    });
    expect(result.errors.filter((e) => e.toLowerCase().includes('ementa'))).toEqual([]);
  });
});

describe('validateActContent — checks de formatação no title', () => {
  it('bloqueia title com mojibake U+FFFD', () => {
    const result = validateActContent({
      content: VALID_BIG,
      title: 'LEI N� 13.709, DE 14 DE AGOSTO DE 2018',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Título.*U\+FFFD/);
  });

  it('bloqueia title vazio', () => {
    const result = validateActContent({
      content: VALID_BIG,
      title: '',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Título vazio/);
  });

  it('aceita title canônico', () => {
    const result = validateActContent({
      content: VALID_BIG,
      title: 'LEI Nº 13.709, DE 14 DE AGOSTO DE 2018',
    });
    expect(result.errors.filter((e) => e.toLowerCase().includes('título'))).toEqual([]);
  });

  it('é no-op quando title não é passado', () => {
    const result = validateActContent({ content: VALID_BIG });
    expect(result.errors.filter((e) => e.toLowerCase().includes('título'))).toEqual([]);
  });
});

describe('validateActContent — consistência year × publishDate', () => {
  it('bloqueia quando publishDate.year ≠ year declarado', () => {
    const result = validateActContent({
      content: VALID_BIG,
      year: 2013,
      publishDate: new Date('2000-11-30T00:00:00Z'),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/publishDate.*2000.*ano 2000.*declarado de 2013/);
  });

  it('aceita quando publishDate.year bate com year', () => {
    const result = validateActContent({
      content: VALID_BIG,
      year: 2018,
      publishDate: new Date('2018-08-14T00:00:00Z'),
    });
    expect(result.errors.filter((e) => /publishDate/.test(e))).toEqual([]);
  });

  it('aceita publishDate como string ISO', () => {
    const result = validateActContent({
      content: VALID_BIG,
      year: 2021,
      publishDate: '2021-04-01T00:00:00.000Z',
    });
    expect(result.errors.filter((e) => /publishDate/.test(e))).toEqual([]);
  });

  it('é no-op quando year ou publishDate ausente', () => {
    const r1 = validateActContent({ content: VALID_BIG, year: 2020 });
    const r2 = validateActContent({ content: VALID_BIG, publishDate: new Date() });
    expect(r1.errors.filter((e) => /publishDate/.test(e))).toEqual([]);
    expect(r2.errors.filter((e) => /publishDate/.test(e))).toEqual([]);
  });
});
