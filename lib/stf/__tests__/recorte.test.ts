// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ehRelevanteParaBase, selecionarRecorte } from '../recorte';
import type { StfDecisaoNormalizada } from '../types';

function decisao(over: Partial<StfDecisaoNormalizada> = {}): StfDecisaoNormalizada {
  return {
    sourceId: 'sjur1',
    fullIdentifier: 'STF sjur1',
    decisionType: 'acordao',
    classe: 'ADI',
    decisionNumber: '1',
    processNumber: null,
    year: 2026,
    title: 'ADI 1',
    ementa: 'Ementa sobre matéria tributária sem relação com o tema.',
    ementaTruncada: false,
    relator: null,
    orgaoJulgador: null,
    dataJulgamento: null,
    dataPublicacao: null,
    url: 'https://jurisprudencia.stf.jus.br/pages/search/sjur1/false',
    uf: null,
    repercussaoGeral: false,
    tema: null,
    tese: null,
    indexacao: null,
    legislacaoCitada: null,
    artigos14133: [],
    citaLei14133: false,
    ...over,
  };
}

describe('ehRelevanteParaBase — acórdãos', () => {
  it('aceita acórdão que cita a Lei 14.133', () => {
    expect(ehRelevanteParaBase(decisao({ citaLei14133: true }))).toBe(true);
  });

  it('aceita acórdão com licitação na ementa, mesmo sem citar a 14.133', () => {
    expect(
      ehRelevanteParaBase(decisao({ ementa: 'Ementa: certame licitatório anulado.' }))
    ).toBe(true);
  });

  it('rejeita acórdão que não cita a norma nem fala de licitação', () => {
    expect(ehRelevanteParaBase(decisao())).toBe(false);
  });
});

describe('ehRelevanteParaBase — monocráticas', () => {
  const mono = (over: Partial<StfDecisaoNormalizada> = {}) =>
    decisao({ decisionType: 'decisao', classe: 'ADI', ...over });

  it('aceita monocrática não-Rcl que cita a norma E fala de licitação', () => {
    expect(
      ehRelevanteParaBase(
        mono({ citaLei14133: true, ementa: 'Decisão sobre licitação municipal.' })
      )
    ).toBe(true);
  });

  it('rejeita reclamação, ainda que cite a norma e fale de licitação', () => {
    expect(
      ehRelevanteParaBase(
        mono({ classe: 'Rcl', citaLei14133: true, ementa: 'Decisão sobre licitação.' })
      )
    ).toBe(false);
  });

  it('rejeita reclamação com classe em MAIÚSCULAS (case-insensitive)', () => {
    expect(
      ehRelevanteParaBase(
        mono({ classe: 'RCL', citaLei14133: true, ementa: 'Decisão sobre licitação.' })
      )
    ).toBe(false);
  });

  it('rejeita reclamação com classe em minúsculas (case-insensitive)', () => {
    expect(
      ehRelevanteParaBase(
        mono({ classe: 'rcl', citaLei14133: true, ementa: 'Decisão sobre licitação.' })
      )
    ).toBe(false);
  });

  it('rejeita monocrática que cita a norma mas não fala de licitação', () => {
    expect(ehRelevanteParaBase(mono({ citaLei14133: true }))).toBe(false);
  });

  it('rejeita monocrática que fala de licitação mas não cita a norma', () => {
    expect(ehRelevanteParaBase(mono({ ementa: 'Decisão sobre licitação.' }))).toBe(false);
  });
});

describe('selecionarRecorte', () => {
  it('filtra e deduplica por sourceId, preservando a ordem de entrada', () => {
    const a = decisao({ sourceId: 'a', citaLei14133: true });
    const b = decisao({ sourceId: 'b' });
    const a2 = decisao({ sourceId: 'a', citaLei14133: true });
    const c = decisao({ sourceId: 'c', ementa: 'Trata de licitação.' });

    expect(selecionarRecorte([a, b, a2, c]).map(d => d.sourceId)).toEqual(['a', 'c']);
  });

  it('devolve vazio para entrada vazia', () => {
    expect(selecionarRecorte([])).toEqual([]);
  });
});
