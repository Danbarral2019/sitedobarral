// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { limparBoilerplate, separarRedacoes } from '../parse-ementa';

/**
 * O texto da lei é o produto, e o público confere antes de citar. Estas regras
 * existem para que o leitor veja a redação vigente sem o entulho da página do
 * Planalto — e, principalmente, para que NUNCA se esconda uma redação sem prova
 * de que ela foi superada.
 */

describe('limparBoilerplate', () => {
  it('remove "(Vide Decreto ...)" do corpo', () => {
    const t = 'valores inferiores a R$ 100.000,00; (Vide Decreto nº 10.922, de 2021) no caso de obras';
    expect(limparBoilerplate(t)).toBe('valores inferiores a R$ 100.000,00; no caso de obras');
  });

  it('remove o marcador "Vigência" que acompanha os Vide', () => {
    const t = 'de obras; (Vide Decreto nº 11.317, de 2022) Vigência (Vide Decreto nº 11.871, de 2023) Vigência';
    expect(limparBoilerplate(t)).toBe('de obras;');
  });

  it('remove "(Vigência)" entre parênteses, não só o solto', () => {
    const t = 'de veículos automotores; (Vide Decreto nº 10.922, de 2021) (Vigência)';
    expect(limparBoilerplate(t)).toBe('de veículos automotores;');
  });

  it('remove "(Regulamento)"', () => {
    expect(limparBoilerplate('nos termos do regulamento. (Regulamento)')).toBe('nos termos do regulamento.');
  });

  // A atribuição não é entulho: diz qual lei fixou a redação em vigor, e o
  // público que confere antes de citar precisa disso.
  it('PRESERVA a atribuição de redação', () => {
    const t = 'compatível com o praticado no mercado; (Redação dada pela Lei nº 14.628, de 2023)';
    expect(limparBoilerplate(t)).toBe(t);
  });

  it('preserva "vigência" quando é palavra da frase, não marcador', () => {
    const t = 'durante a vigência do contrato administrativo';
    expect(limparBoilerplate(t)).toBe(t);
  });

  it('não deixa espaço duplo nem espaço antes de pontuação', () => {
    const t = 'texto (Vide Decreto nº 1, de 2020) Vigência , e segue';
    expect(limparBoilerplate(t)).not.toMatch(/\s{2,}|\s+,/);
  });
});

describe('separarRedacoes', () => {
  const bloco = (marc: string, texto: string, nota?: string) =>
    `${marc} — ${texto}${nota ? ` (${nota})` : ''}`;

  it('recolhe as anteriores quando há prova de alteração, mantendo a última', () => {
    const entrada = [
      bloco('XVI', 'texto original.'),
      bloco('XVI', 'texto da MP; e', 'Redação dada pela Medida Provisória nº 1.166, de 2023'),
      bloco('XVI', 'texto da lei;', 'Redação dada pela Lei nº 14.628, de 2023'),
      bloco('XVII', 'inciso seguinte.'),
    ].join('\n\n');

    const { vigente, anteriores } = separarRedacoes(entrada);

    expect(anteriores).toHaveLength(2);
    expect(vigente).toContain('texto da lei;');
    expect(vigente).not.toContain('texto original.');
    expect(vigente).toContain('XVII — inciso seguinte.');
    expect(anteriores[0].marcador).toBe('XVI');
    expect(anteriores[1].fonte).toContain('Medida Provisória');
  });

  // A regra conservadora: sem nota de alteração, não há prova de que uma
  // versão superou a outra. Esconder seria adivinhar.
  it('NÃO recolhe nada quando nenhum bloco repetido traz nota', () => {
    const entrada = [bloco('I', 'primeira.'), bloco('I', 'segunda.')].join('\n\n');

    const { vigente, anteriores } = separarRedacoes(entrada);

    expect(anteriores).toEqual([]);
    expect(vigente).toContain('primeira.');
    expect(vigente).toContain('segunda.');
  });

  // Artigo cujo § tem lista própria: I..V no caput e I..V no § 1º. As
  // repetições não são adjacentes, e mexer nelas apagaria metade do artigo.
  it('não toca em marcador que se repete em seção diferente', () => {
    const entrada = [
      bloco('I', 'do caput.'),
      bloco('II', 'do caput.'),
      '§ 1º Para os fins deste artigo:',
      bloco('I', 'do parágrafo.'),
      bloco('II', 'do parágrafo.'),
    ].join('\n\n');

    const { vigente, anteriores } = separarRedacoes(entrada);

    expect(anteriores).toEqual([]);
    expect(vigente).toBe(entrada);
  });

  it('preserva o caput e a ordem das demais linhas', () => {
    const entrada = [
      'É dispensável a licitação:',
      bloco('I', 'antiga.'),
      bloco('I', 'nova.', 'Redação dada pela Lei nº 14.628, de 2023'),
      bloco('II', 'seguinte.'),
    ].join('\n\n');

    const { vigente } = separarRedacoes(entrada);
    const linhas = vigente.split('\n\n');

    expect(linhas[0]).toBe('É dispensável a licitação:');
    expect(linhas[1]).toContain('nova.');
    expect(linhas[2]).toContain('II — seguinte.');
  });

  it('devolve o texto intacto quando não há repetição alguma', () => {
    const entrada = [bloco('I', 'uma.'), bloco('II', 'duas.')].join('\n\n');
    expect(separarRedacoes(entrada)).toEqual({ vigente: entrada, anteriores: [] });
  });

  it('funciona com marcador de parágrafo, não só inciso', () => {
    const entrada = [
      '§ 6º redação antiga.',
      '§ 6º redação nova. (Incluído pela Lei nº 14.770, de 2023)',
    ].join('\n\n');

    const { vigente, anteriores } = separarRedacoes(entrada);

    expect(anteriores).toHaveLength(1);
    expect(vigente).toContain('redação nova.');
  });
});
