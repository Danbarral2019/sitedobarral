// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { normalizarEspelho } from '../normalizar';
import type { EspelhoBruto } from '../types';

function espelho(over: Partial<EspelhoBruto> = {}): EspelhoBruto {
  return {
    id: '959632',
    numeroRegistro: '202402187409',
    numeroProcesso: '2669939',
    siglaClasse: 'REsp',
    descricaoClasse: 'RECURSO ESPECIAL',
    nomeOrgaoJulgador: 'PRIMEIRA SEÇÃO',
    ministroRelator: 'FRANCISCO FALCÃO',
    dataPublicacao: 'DJEN       DATA:22/05/2026',
    dataDecisao: '20260519',
    ementa: 'ADMINISTRATIVO. LICITAÇÃO. PREGÃO.',
    tipoDeDecisao: 'ACÓRDÃO',
    referenciasLegislativas: [],
    ...over,
  };
}

describe('normalizarEspelho — datas', () => {
  it('converte dataDecisao AAAAMMDD em Date correta', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    expect(d.dataJulgamento?.toISOString().slice(0, 10)).toBe('2026-05-19');
  });

  it('extrai a data de publicação de dentro do rótulo do diário', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    expect(d.dataPublicacao?.toISOString().slice(0, 10)).toBe('2026-05-22');
  });

  it('devolve null em vez de Invalid Date quando a data é lixo', () => {
    const d = normalizarEspelho(espelho({ dataDecisao: 'xx', dataPublicacao: null }), 'Primeira Seção')!;
    expect(d.dataJulgamento).toBeNull();
    expect(d.dataPublicacao).toBeNull();
  });

  it('deriva o ano da data de decisão', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    expect(d.year).toBe(2026);
  });
});

describe('normalizarEspelho — identidade', () => {
  it('usa numeroRegistro como sourceId e monta fullIdentifier estável', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    expect(d.sourceId).toBe('202402187409');
    expect(d.fullIdentifier).toBe('stj-acordao-202402187409');
  });

  it('descarta espelho sem numeroRegistro', () => {
    expect(normalizarEspelho(espelho({ numeroRegistro: null }), 'Primeira Seção')).toBeNull();
  });

  it('descarta espelho sem ementa', () => {
    expect(normalizarEspelho(espelho({ ementa: '   ' }), 'Primeira Seção')).toBeNull();
  });
});

describe('normalizarEspelho — amarração à norma', () => {
  it('extrai artigos da 14.133 do campo estruturado', () => {
    const d = normalizarEspelho(
      espelho({ referenciasLegislativas: ['LEG:FED LEI:014133 ANO:2021\n        ART:00075'] }),
      'Primeira Seção'
    )!;
    expect(d.artigos14133).toEqual(['75']);
    expect(d.citaLei14133).toBe(true);
  });

  it('não inventa artigo a partir de menção solta na ementa', () => {
    const d = normalizarEspelho(
      espelho({ ementa: 'Ofensa ao art. 37 da Constituição Federal.' }),
      'Primeira Seção'
    )!;
    expect(d.artigos14133).toEqual([]);
  });
});

describe('normalizarEspelho — mojibake', () => {
  /**
   * Detector de UTF-8 lido como Latin-1.
   *
   * NÃO usar `/Ã[A-Z]/`: em texto maiúsculo português "ÃO" é a terminação mais
   * comum que existe (FALCÃO, LICITAÇÃO, PREGÃO, SEÇÃO, DECISÃO), e as ementas
   * do STJ vêm em caixa alta — aquele padrão acusa mojibake em 100% dos textos
   * legítimos. Medido: 4 falsos positivos em 4 amostras legítimas.
   *
   * O que de fato distingue: o caractere de substituição U+FFFD, "Ã" seguido de
   * maiúscula que não seja O nem S (as únicas terminações legítimas em caixa
   * alta), e as sequências clássicas em caixa baixa.
   */
  const RE_MOJIBAKE = /�|Ã(?![OS])[A-Z]|Ã[©¡­³ºç£µ]/;

  it('não acusa mojibake em acentuação legítima de texto maiúsculo', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    const textos = [d.title, d.ementa, d.relator ?? '', d.orgaoJulgador ?? ''].join(' ');
    expect(textos).not.toMatch(RE_MOJIBAKE);
  });

  it('reconhece o mojibake que o conector do DataJud gravava', () => {
    // strings reais lidas do banco em 18/08/2026
    expect('RICARDO VILLAS BÃAS CUEVA').toMatch(RE_MOJIBAKE);
    expect('PRESIDÃNCIA').toMatch(RE_MOJIBAKE);
    expect('NÃCLEO DE GERENCIAMENTO').toMatch(RE_MOJIBAKE);
  });

  it('preserva acentuação legítima', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    expect(d.relator).toBe('FRANCISCO FALCÃO');
  });
});
