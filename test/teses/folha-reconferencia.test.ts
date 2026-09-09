// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { selecionarReconferencia } from '../../lib/teses/reconferencia';

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
