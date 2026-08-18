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
    const e = espelho({ teseJuridica: 'É vedada a inexigibilidade fora das hipóteses legais.' });
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
});
