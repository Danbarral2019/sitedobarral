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

  it('detecta overflow silencioso (31 de fevereiro)', () => {
    const d = normalizarEspelho(espelho({ dataDecisao: '20260231' }), 'Primeira Seção')!;
    expect(d.dataJulgamento).toBeNull();
  });

  it('detecta overflow silencioso em rótulo (mês 99)', () => {
    const d = normalizarEspelho(espelho({ dataPublicacao: 'DJEN DATA:22/99/2026' }), 'Primeira Seção')!;
    expect(d.dataPublicacao).toBeNull();
  });
});

describe('normalizarEspelho — identidade', () => {
  it('usa numeroRegistro como sourceId e monta fullIdentifier estável', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    expect(d.sourceId).toBe('959632');
    expect(d.fullIdentifier).toBe('stj-acordao-959632');
  });

  it('descarta espelho sem numeroRegistro', () => {
    expect(normalizarEspelho(espelho({ numeroRegistro: null }), 'Primeira Seção')).toBeNull();
  });

  it('descarta espelho sem ementa', () => {
    expect(normalizarEspelho(espelho({ ementa: '   ' }), 'Primeira Seção')).toBeNull();
  });

  it('fallback para ano corrente quando ambas datas nulas e registro inválido', () => {
    const d = normalizarEspelho(
      espelho({ dataDecisao: null, dataPublicacao: null, numeroRegistro: 'abc-12345-xyz' }),
      'Primeira Seção'
    )!;
    const currentYear = new Date().getUTCFullYear();
    expect(d.year).toBe(currentYear);
  });

  it('usa year do registro quando ambas datas nulas mas registro começa com ano plausível', () => {
    const d = normalizarEspelho(
      espelho({ dataDecisao: null, dataPublicacao: null, numeroRegistro: '201501234567' }),
      'Primeira Seção'
    )!;
    expect(d.year).toBe(2015);
  });
});

describe('normalizarEspelho — identidade do acórdão', () => {
  it('usa o id do espelho, não o numeroRegistro, como identificador', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    expect(d.fullIdentifier).toBe('stj-acordao-959632');
  });

  it('dois acórdãos do MESMO processo geram identificadores distintos', () => {
    // numeroRegistro identifica o processo, não o julgado: um processo rende
    // REsp, depois AgInt, depois EDcl, todos com o mesmo número. Chavear pelo
    // registro descartaria 1,9% do acervo (medido em 1.458 espelhos reais).
    const resp = normalizarEspelho(
      espelho({ id: '930995', siglaClasse: 'REsp', dataDecisao: '20251015' }),
      'Segunda Turma'
    )!;
    const edcl = normalizarEspelho(
      espelho({ id: '957349', siglaClasse: 'EDcl nos EDcl no REsp', dataDecisao: '20260506' }),
      'Segunda Turma'
    )!;
    expect(resp.numeroRegistro).toBe(edcl.numeroRegistro);
    expect(resp.fullIdentifier).not.toBe(edcl.fullIdentifier);
  });

  it('preserva o numeroRegistro em campo próprio, para a URL e a citação', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    expect(d.numeroRegistro).toBe('202402187409');
    expect(d.url).toContain('202402187409');
  });

  it('cai no numeroRegistro quando o espelho não traz id', () => {
    const d = normalizarEspelho(espelho({ id: undefined }), 'Primeira Seção')!;
    expect(d.fullIdentifier).toBe('stj-acordao-202402187409');
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
   * Detector preciso de UTF-8 lido como Latin-1.
   *
   * A estrutura de mojibake: UTF-8 lido como Latin-1 sempre produz Ã ou Â
   * seguido de um caractere no bloco U+0080–U+00BF (Latin-1 Supplement).
   *
   * Três ramos:
   * 1. Caractere de substituição (U+FFFD)
   * 2. Estrutura completa: [ÃÂ] seguido de qualquer byte no bloco U+0080–U+00BF
   * 3. Caixa alta: Ã seguido de maiúscula que não seja O ou S (casos do DataJud)
   */
  const RE_MOJIBAKE = /�|[ÃÂ][-¿]|Ã(?![OSE])[A-Z]/;

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

  it('detecta acentos corrompidos em caixa baixa (Ã© e Ã£)', () => {
    // "é" corrompido (Ã©): UTF-8 0xC3 0xA9 lido como Latin-1
    // "ã" corrompido (Ã£): UTF-8 0xC3 0xA3 lido como Latin-1
    // Ambos casam [ÃÂ][-¿] porque © (U+00A9) e £ (U+00A3) estão em U+0080–U+00BF
    expect('PaulÃ£').toMatch(RE_MOJIBAKE);
    expect('PaulÃ©').toMatch(RE_MOJIBAKE);
  });

  it('confirma que PREGÃO, SEÇÃO, DECISÃO continuam limpos', () => {
    expect('PREGÃO').not.toMatch(RE_MOJIBAKE);
    expect('SEÇÃO').not.toMatch(RE_MOJIBAKE);
    expect('DECISÃO').not.toMatch(RE_MOJIBAKE);
  });

  it('exclui plurais em -ões e -ães: MAGALHÃES, CAPITÃES, ALEMÃES, CIDADÃES', () => {
    // Medição contra os 384 espelhos: 16 falsos positivos, todos em MAGALHÃES
    expect('ASSUSETE MAGALHÃES').not.toMatch(RE_MOJIBAKE);
    expect('CAPITÃES DE INDÚSTRIA').not.toMatch(RE_MOJIBAKE);
    expect('ALEMÃES').not.toMatch(RE_MOJIBAKE);
    expect('CIDADÃES').not.toMatch(RE_MOJIBAKE);
  });
});

describe('normalizarEspelho — limpeza de caracteres invisíveis', () => {
  it('descarta ementa composta só de espaços invisíveis', () => {
    // U+200B (zero-width space) + U+200C (zero-width non-joiner) + U+200D (zero-width joiner)
    expect(normalizarEspelho(espelho({ ementa: '​‌‍' }), 'Primeira Seção')).toBeNull();
  });

  it('remove invisíveis e trata como espaço em branco', () => {
    // Ementa com invisible characters misturados com texto
    const d = normalizarEspelho(
      espelho({ ementa: 'DIREITO​ CIVIL' }), // U+200B entre DIREITO e CIVIL
      'Primeira Seção'
    )!;
    expect(d.ementa).toBe('DIREITO CIVIL');
  });
});
