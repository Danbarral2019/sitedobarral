// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ehRelevanteParaBase } from '../recorte';
import type { EspelhoBruto } from '../types';

function espelho(over: Partial<EspelhoBruto> = {}): EspelhoBruto {
  return {
    id: '959632',
    numeroRegistro: '202402187409',
    siglaClasse: 'REsp',
    nomeOrgaoJulgador: 'PRIMEIRA SEÇÃO',
    ementa: 'PROCESSUAL CIVIL E TRIBUTÁRIO. ICMS. CREDITAMENTO.',
    referenciasLegislativas: [],
    ...over,
  };
}

describe('ehRelevanteParaBase', () => {
  it('entra pela referência legislativa à Lei 14.133, mesmo sem vocabulário na ementa', () => {
    const e = espelho({
      referenciasLegislativas: ['LEG:FED LEI:014133 ANO:2021\n        ART:00075'],
    });
    expect(ehRelevanteParaBase(e)).toBe(true);
  });

  it('entra pela referência à Lei 8.666', () => {
    const e = espelho({ referenciasLegislativas: ['LEG:FED LEI:008666 ANO:1993\n ART:00024'] });
    expect(ehRelevanteParaBase(e)).toBe(true);
  });

  it('entra pelo vocabulário na ementa, mesmo sem referência estruturada', () => {
    const e = espelho({ ementa: 'ADMINISTRATIVO. LICITAÇÃO. PREGÃO ELETRÔNICO. HABILITAÇÃO.' });
    expect(ehRelevanteParaBase(e)).toBe(true);
  });

  it('entra pelo vocabulário na tese jurídica', () => {
    const e = espelho({ teseJuridica: 'É vedada a inexigibilidade de licitação fora das hipóteses legais.' });
    expect(ehRelevanteParaBase(e)).toBe(true);
  });

  it('fica de fora quando ementa contém "explicitação das circunstâncias"', () => {
    const e = espelho({ ementa: 'PROCESSUAL CIVIL. EXPLICITAÇÃO DAS CIRCUNSTÂNCIAS.' });
    expect(ehRelevanteParaBase(e)).toBe(false);
  });

  it('fica de fora quando ementa contém "manifestou-se explicitamente sobre a matéria"', () => {
    const e = espelho({ ementa: 'TRIBUTÁRIO. ICMS. MANIFESTOU-SE EXPLICITAMENTE SOBRE A MATÉRIA.' });
    expect(ehRelevanteParaBase(e)).toBe(false);
  });

  it('fica de fora quando ementa contém "implicitamente reconhecido"', () => {
    const e = espelho({ ementa: 'CIVIL. DIREITO DE FAMÍLIA. IMPLICITAMENTE RECONHECIDO.' });
    expect(ehRelevanteParaBase(e)).toBe(false);
  });

  it('fica de fora quando ementa contém "ação declaratória de inexigibilidade de débito"', () => {
    const e = espelho({ ementa: 'TRIBUTÁRIO. AÇÃO DECLARATÓRIA DE INEXIGIBILIDADE DE DÉBITO.' });
    expect(ehRelevanteParaBase(e)).toBe(false);
  });

  it('entra quando ementa contém "inexigibilidade de licitação"', () => {
    const e = espelho({ ementa: 'ADMINISTRATIVO. INEXIGIBILIDADE DE LICITAÇÃO. FUNDAMENTOS.' });
    expect(ehRelevanteParaBase(e)).toBe(true);
  });

  it('entra quando ementa contém "LICITAÇÃO. CONTRATAÇÃO DE EMPRESA"', () => {
    const e = espelho({ ementa: 'ADMINISTRATIVO. LICITAÇÃO. CONTRATAÇÃO DE EMPRESA.' });
    expect(ehRelevanteParaBase(e)).toBe(true);
  });

  it('fica de fora o acórdão tributário sem licitação', () => {
    expect(ehRelevanteParaBase(espelho())).toBe(false);
  });

  it('fica de fora quando só há referência a outra lei', () => {
    const e = espelho({ referenciasLegislativas: ['LEG:FED LEI:013105 ANO:2015\n ART:00967'] });
    expect(ehRelevanteParaBase(e)).toBe(false);
  });

  it('não quebra com campos nulos', () => {
    const e = espelho({ ementa: null, teseJuridica: null, referenciasLegislativas: null });
    expect(ehRelevanteParaBase(e)).toBe(false);
  });

  it('fica de fora quando ementa contém "prova obtida licitamente nos autos"', () => {
    const e = espelho({ ementa: 'PROCESSUAL CIVIL. PROVA OBTIDA LICITAMENTE NOS AUTOS.' });
    expect(ehRelevanteParaBase(e)).toBe(false);
  });

  it('entra quando ementa contém "LICITAÇÃO. PREGÃO ELETRÔNICO."', () => {
    const e = espelho({ ementa: 'ADMINISTRATIVO. LICITAÇÃO. PREGÃO ELETRÔNICO. CONVALIDAÇÃO.' });
    expect(ehRelevanteParaBase(e)).toBe(true);
  });

  it('entra quando ementa contém "os licitantes foram habilitados"', () => {
    const e = espelho({ ementa: 'LICITAÇÃO. HABILITAÇÃO. OS LICITANTES FORAM HABILITADOS CORRETAMENTE.' });
    expect(ehRelevanteParaBase(e)).toBe(true);
  });

  it('entra quando ementa contém "processo licitatório"', () => {
    const e = espelho({ ementa: 'ADMINISTRATIVO. PROCESSO LICITATÓRIO. NULIDADE.' });
    expect(ehRelevanteParaBase(e)).toBe(true);
  });
});
