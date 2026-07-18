import { describe, it, expect } from 'vitest';
import {
  densidade,
  porSecao,
  taxaMatching,
  rankingLeadingCases,
  type CitacaoProcessada,
} from './precedentes-probe-stats';

const C = (
  origemId: string,
  numero: number,
  ano: number,
  secao: CitacaoProcessada['secao'],
  matched: boolean
): CitacaoProcessada => ({ origemId, numero, ano, secao, matched, alvoId: matched ? 'alvo' : null });

describe('densidade', () => {
  it('conta média e mediana preenchendo zeros para acórdãos sem citação', () => {
    // 3 citações vindas de 2 acórdãos distintos; universo de 4 acórdãos.
    const cits = [C('a', 1, 2020, 'voto', true), C('a', 2, 2020, 'voto', true), C('b', 3, 2020, 'relatorio', false)];
    const d = densidade(cits, 4);
    expect(d.totalCitacoes).toBe(3);
    expect(d.acordaosComCitacao).toBe(2);
    expect(d.media).toBeCloseTo(0.75); // 3 / 4
    expect(d.mediana).toBe(0.5); // contagens [0,0,1,2] → (0+1)/2
  });
});

describe('porSecao', () => {
  it('agrupa por seção e conta os sem seção', () => {
    const cits = [
      C('a', 1, 2020, 'voto', true),
      C('a', 2, 2020, 'voto', true),
      C('b', 3, 2020, 'relatorio', true),
      C('c', 4, 2020, null, false),
    ];
    expect(porSecao(cits)).toEqual({ relatorio: 1, voto: 2, acordao: 0, semSecao: 1 });
  });
});

describe('taxaMatching', () => {
  it('separa internas de externas', () => {
    const cits = [C('a', 1, 2020, 'voto', true), C('a', 2, 2020, 'voto', false), C('b', 3, 2020, 'voto', false)];
    expect(taxaMatching(cits)).toEqual({ internas: 1, externas: 2, taxa: 1 / 3 });
  });
});

describe('rankingLeadingCases', () => {
  it('conta acórdãos DISTINTOS que citam cada alvo e ordena por autoridade', () => {
    const cits = [
      C('a', 100, 2013, 'voto', true),
      C('b', 100, 2013, 'voto', true), // mesmo alvo, outro citante
      C('b', 100, 2013, 'relatorio', true), // duplicata do mesmo citante 'b' → não conta 2x
      C('c', 200, 2015, 'relatorio', true),
    ];
    const r = rankingLeadingCases(cits, 10);
    expect(r[0]).toEqual({ chave: '100/2013', alvoId: 'alvo', citadoPor: 2, noVoto: 2 });
    expect(r[1]).toMatchObject({ chave: '200/2015', citadoPor: 1, noVoto: 0 });
  });
});
