import { describe, it, expect } from 'vitest';
import { citaLeiDeLicitacao, devePromover, tagsPublicas, PADRAO_LEI_DE_LICITACAO } from './publicacao-grafo';

describe('citaLeiDeLicitacao', () => {
  it.each([
    'nos termos da Lei nº 14.133/2021',
    'art. 3º da Lei 8.666/1993',
    'LEI N.º 10.520, DE 2002',
    'Lei no 12.462/2011 (RDC)',
    'Lei 13.303/2016',
    'lei 14133/2021',
  ])('reconhece "%s"', (t) => expect(citaLeiDeLicitacao(t)).toBe(true));

  it.each([
    'Lei 8.112/1990 (regime jurídico dos servidores)',
    'Lei 8.443/1992, art. 58',
    'Decreto 10.024/2019',
    'Instrução Normativa 5/2017',
    '',
  ])('não reconhece "%s"', (t) => expect(citaLeiDeLicitacao(t)).toBe(false));

  it('não aceita nulo', () => expect(citaLeiDeLicitacao(null)).toBe(false));

  it('o padrão compartilhado com o SQL não usa sintaxe exclusiva do JS', () => {
    expect(PADRAO_LEI_DE_LICITACAO).not.toMatch(/\(\?[<=!]/);
    // "\s" não existe no regex do Postgres com a mesma semântica; usar [[:space:]].
    expect(PADRAO_LEI_DE_LICITACAO).not.toContain(String.raw`\s`);
  });
});

describe('devePromover', () => {
  const texto = 'Lei 14.133/2021';
  it('só promove acórdão do grafo, que cita lei de licitações e não duplica acórdão curado', () => {
    expect(devePromover({ category: 'acordao-grafo', tcuTextoCompleto: texto, duplicaCurado: false })).toBe(true);
    expect(devePromover({ category: 'acordao-grafo', tcuTextoCompleto: texto, duplicaCurado: true })).toBe(false);
    expect(devePromover({ category: 'acordao', tcuTextoCompleto: texto, duplicaCurado: false })).toBe(false);
    expect(devePromover({ category: 'acordao-grafo', tcuTextoCompleto: 'Lei 8.112', duplicaCurado: false })).toBe(false);
    expect(devePromover({ category: 'acordao-grafo', tcuTextoCompleto: null, duplicaCurado: false })).toBe(false);
  });
});

describe('tagsPublicas', () => {
  it('tira o marcador interno "grafo" e preserva o resto', () => {
    expect(tagsPublicas('["TCU","Acórdão","grafo","Plenário","2025"]')).toBe('["TCU","Acórdão","Plenário","2025"]');
  });
  it('tolera nulo e JSON inválido', () => {
    expect(tagsPublicas(null)).toBeNull();
    expect(tagsPublicas('x')).toBe('x');
  });
});
