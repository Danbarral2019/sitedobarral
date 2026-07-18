import { describe, it, expect } from 'vitest';
import { arestasDeAcordao } from './extrair-arestas-precedentes';

describe('arestasDeAcordao', () => {
  it('deduplica por par (numeroAlvo, anoAlvo) e conta ocorrências', () => {
    const t = 'cita o Acórdão 100/2015 e depois o Acórdão 100/2015 de novo.';
    const as = arestasDeAcordao(t, { numero: 1, ano: 2020 });
    expect(as).toHaveLength(1);
    expect(as[0]).toMatchObject({ numeroAlvo: 100, anoAlvo: 2015, ocorrencias: 2 });
  });

  it('descarta auto-citação', () => {
    const t = 'este é o Acórdão 500/2021 e cita o Acórdão 900/2019.';
    const as = arestasDeAcordao(t, { numero: 500, ano: 2021 });
    expect(as.map((a) => a.numeroAlvo)).toEqual([900]);
  });

  it('marca noVoto quando a citação cai na seção do voto', () => {
    // RELATÓRIO ... VOTO ... ACÓRDÃO Nº — o marcador de voto em linha própria.
    const t = [
      'RELATÓRIO',
      'a parte alega ofensa ao Acórdão 111/2010.',
      'VOTO',
      'acompanho o Acórdão 222/2011 como razão de decidir.',
      'ACÓRDÃO Nº 9/2022 - TCU - Plenário',
    ].join('\n');
    const as = arestasDeAcordao(t, { numero: 9, ano: 2022 });
    const rel = as.find((a) => a.numeroAlvo === 111);
    const voto = as.find((a) => a.numeroAlvo === 222);
    expect(rel?.noVoto).toBe(false);
    expect(voto?.noVoto).toBe(true);
  });

  it('não quebra quando self é nulo (não filtra por número inexistente)', () => {
    const as = arestasDeAcordao('cita o Acórdão 7/2007.', { numero: null, ano: null });
    expect(as).toHaveLength(1);
    expect(as[0].numeroAlvo).toBe(7);
  });
});
