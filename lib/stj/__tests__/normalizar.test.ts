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
    nomeOrgaoJulgador: 'PRIMEIRA TURMA',
    ministroRelator: 'JORGE MUSSI',
    dataPublicacao: 'DJEN       DATA:22/05/2026',
    dataDecisao: '20260519',
    ementa: 'DIREITO CIVIL. CONTRATO. EXECUCAO.',
    tipoDeDecisao: 'ACÓRDÃO',
    referenciasLegislativas: [],
    ...over,
  };
}

describe('normalizarEspelho — datas', () => {
  it('converte dataDecisao AAAAMMDD em Date correta', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Turma')!;
    expect(d.dataJulgamento?.toISOString().slice(0, 10)).toBe('2026-05-19');
  });

  it('extrai a data de publicação de dentro do rótulo do diário', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Turma')!;
    expect(d.dataPublicacao?.toISOString().slice(0, 10)).toBe('2026-05-22');
  });

  it('devolve null em vez de Invalid Date quando a data é lixo', () => {
    const d = normalizarEspelho(espelho({ dataDecisao: 'xx', dataPublicacao: null }), 'Primeira Turma')!;
    expect(d.dataJulgamento).toBeNull();
    expect(d.dataPublicacao).toBeNull();
  });

  it('deriva o ano da data de decisão', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Turma')!;
    expect(d.year).toBe(2026);
  });
});

describe('normalizarEspelho — identidade', () => {
  it('usa numeroRegistro como sourceId e monta fullIdentifier estável', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Turma')!;
    expect(d.sourceId).toBe('202402187409');
    expect(d.fullIdentifier).toBe('stj-acordao-202402187409');
  });

  it('descarta espelho sem numeroRegistro', () => {
    expect(normalizarEspelho(espelho({ numeroRegistro: null }), 'Primeira Turma')).toBeNull();
  });

  it('descarta espelho sem ementa', () => {
    expect(normalizarEspelho(espelho({ ementa: '   ' }), 'Primeira Turma')).toBeNull();
  });
});

describe('normalizarEspelho — amarração à norma', () => {
  it('extrai artigos da 14.133 do campo estruturado', () => {
    const d = normalizarEspelho(
      espelho({ referenciasLegislativas: ['LEG:FED LEI:014133 ANO:2021\n        ART:00075'] }),
      'Primeira Turma'
    )!;
    expect(d.artigos14133).toEqual(['75']);
    expect(d.citaLei14133).toBe(true);
  });

  it('não inventa artigo a partir de menção solta na ementa', () => {
    const d = normalizarEspelho(
      espelho({ ementa: 'Ofensa ao art. 37 da Constituição Federal.' }),
      'Primeira Turma'
    )!;
    expect(d.artigos14133).toEqual([]);
  });
});

describe('normalizarEspelho — mojibake', () => {
  it('nenhum campo textual sai com mojibake', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Turma')!;
    const textos = [d.title, d.ementa, d.relator ?? '', d.orgaoJulgador ?? ''].join(' ');
    // "Ã" seguido de maiúscula é a assinatura de UTF-8 lido como Latin-1
    // (foi assim que o conector do DataJud gravou "VILLAS BÃAS" e "PRESIDÃNCIA")
    expect(textos).not.toMatch(/Ã[A-Z]/);
  });

  it('preserva acentuação legítima', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Turma')!;
    expect(d.relator).toBe('JORGE MUSSI');
  });
});
