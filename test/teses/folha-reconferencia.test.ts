// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { selecionarReconferencia } from '../../lib/teses/reconferencia';
import { agruparReconferencia } from '../../scripts/lib/folha-teses-template.mjs';

const anterior = {
  id: 'ant-1',
  enunciado: 'Redacao antiga, aprovada em agosto.',
  julgadoPor: 'daniel',
  julgadoEm: new Date('2026-08-13T00:00:00Z'),
};

const destilacao = (over = {}) => ({
  chave: '1441/2016',
  numeroAlvo: 1441,
  anoAlvo: 2016,
  enunciados: [{
    id: 'novo-1',
    enunciado: 'Redacao nova, ninguem leu.',
    reconferenciaPendente: true,
    herdadoDe: 'ant-1',
    ...over,
  }],
});

describe('selecionarReconferencia', () => {
  it('traz o texto novo ao lado do texto que foi aprovado', () => {
    const r = selecionarReconferencia([destilacao()], new Map([['ant-1', anterior]]));
    expect(r).toHaveLength(1);
    expect(r[0].enunciadoNovo).toBe('Redacao nova, ninguem leu.');
    expect(r[0].enunciadoAnterior).toBe('Redacao antiga, aprovada em agosto.');
    expect(r[0].julgadoPor).toBe('daniel');
  });

  it('ignora enunciado sem pendencia', () => {
    const r = selecionarReconferencia([destilacao({ reconferenciaPendente: false })], new Map([['ant-1', anterior]]));
    expect(r).toHaveLength(0);
  });

  // Sem o antecessor nao ha o que comparar, e um cartao com um lado vazio pede
  // um julgamento as cegas — que e o oposto do proposito da secao.
  it('ignora pendencia cujo antecessor sumiu do banco', () => {
    const r = selecionarReconferencia([destilacao()], new Map());
    expect(r).toHaveLength(0);
  });
});

// O veredito da folha é gravado por acórdão (`store.cards[chave]`), então dois
// cards para a mesma chave operariam um estado só: clicar num mudava os dois, e
// o contador somava enunciados onde a spec §3.2 conta casos.
describe('agruparReconferencia', () => {
  const julgadoEm = new Date('2026-08-13T00:00:00Z');
  const cartao = (chave: string, novo: string, anterior: string) => ({
    chave, enunciadoNovo: novo, enunciadoAnterior: anterior, julgadoPor: 'daniel', julgadoEm,
  });

  it('empilha os pares do mesmo acordao sob um cartao so', () => {
    const g = agruparReconferencia([
      cartao('1441/2016', 'Nova A.', 'Antiga A.'),
      cartao('1441/2016', 'Nova B.', 'Antiga B.'),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].chave).toBe('1441/2016');
    expect(g[0].pares).toEqual([
      { enunciadoNovo: 'Nova A.', enunciadoAnterior: 'Antiga A.' },
      { enunciadoNovo: 'Nova B.', enunciadoAnterior: 'Antiga B.' },
    ]);
    expect(g[0].julgadoPor).toBe('daniel');
  });

  it('mantem acordaos distintos separados, na ordem de chegada', () => {
    const g = agruparReconferencia([
      cartao('999/2020', 'Nova C.', 'Antiga C.'),
      cartao('1441/2016', 'Nova A.', 'Antiga A.'),
      cartao('999/2020', 'Nova D.', 'Antiga D.'),
    ]);
    expect(g.map((x) => x.chave)).toEqual(['999/2020', '1441/2016']);
    expect(g[0].pares).toHaveLength(2);
    expect(g[1].pares).toHaveLength(1);
  });

  it('fila vazia nao produz grupo algum', () => {
    expect(agruparReconferencia([])).toEqual([]);
  });
});
