// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extrairArtigos14133, citaLei14133 } from '../legislacao-citada';

// Formato do STF: separador "-"
const STF_14133 = `LEG-FED   LEI-014133 ANO-2021
    ART-00006 ART-00075 INC-00002
    LEI ORDINÁRIA`;

// Formato do STJ: separador ":"
const STJ_14133 = `LEG:FED LEI:014133 ANO:2021
 *****  NLL-21    NOVA LEI DE LICITAÇÕES
        ART:00075`;

const STJ_CPC = `LEG:FED LEI:013105 ANO:2015
 *****  CPC-15    CÓDIGO DE PROCESSO CIVIL DE 2015
        ART:00967`;

// Outro bloco da 14.133 no formato do STJ, com artigo distinto dos demais —
// usado para provar que exec() não vaza lastIndex de um bloco para o outro.
const STJ_14133_ART92 = `LEG:FED LEI:014133 ANO:2021
 *****  NLL-21    NOVA LEI DE LICITAÇÕES
        ART:00092`;

// Sufixo de letra em caixas diferentes, para provar a normalização.
const STF_14133_ART184A_MAIUSCULO = `LEG-FED   LEI-014133 ANO-2021
    ART-00184-A
    LEI ORDINÁRIA`;

const STF_14133_ART184A_MINUSCULO = `LEG-FED   LEI-014133 ANO-2021
    ART-00184-a
    LEI ORDINÁRIA`;

describe('extrairArtigos14133 — separador do STF', () => {
  it('extrai artigos do bloco com hífen', () => {
    expect(extrairArtigos14133([STF_14133])).toEqual(['6', '75']);
  });
});

describe('extrairArtigos14133 — separador do STJ', () => {
  it('extrai artigos do bloco com dois-pontos', () => {
    expect(extrairArtigos14133([STJ_14133])).toEqual(['75']);
  });

  it('ignora bloco de outra lei no formato do STJ', () => {
    expect(extrairArtigos14133([STJ_CPC])).toEqual([]);
  });

  it('separa por bloco: só os artigos do bloco da 14.133 entram', () => {
    expect(extrairArtigos14133([STJ_CPC, STJ_14133])).toEqual(['75']);
  });

  it('junta os artigos de dois blocos distintos da 14.133, um em cada formato', () => {
    expect(extrairArtigos14133([STF_14133, STJ_14133_ART92])).toEqual(['6', '75', '92']);
  });

  it('é case-insensitive: bloco em minúsculas também tem seus artigos extraídos', () => {
    const bloco = STF_14133.toLowerCase();
    expect(citaLei14133([bloco])).toBe(true);
    expect(extrairArtigos14133([bloco])).toEqual(['6', '75']);
  });

  it('normaliza o sufixo de letra para maiúscula mesmo vindo minúsculo da fonte', () => {
    expect(extrairArtigos14133([STF_14133_ART184A_MINUSCULO])).toEqual(['184-A']);
  });

  it('continua produzindo o sufixo em maiúscula quando a fonte já vem em maiúscula', () => {
    expect(extrairArtigos14133([STF_14133_ART184A_MAIUSCULO])).toEqual(['184-A']);
  });
});

describe('citaLei14133', () => {
  it('reconhece a lei nos dois formatos', () => {
    expect(citaLei14133([STF_14133])).toBe(true);
    expect(citaLei14133([STJ_14133])).toBe(true);
  });

  it('é falso quando só há outra lei', () => {
    expect(citaLei14133([STJ_CPC])).toBe(false);
  });
});

/**
 * O token da lei sozinho não identifica a Lei 14.133/2021. Medido em
 * 30/08/2026 sobre a fonte do STF (1.071 julgados capturados): 22 blocos
 * declaram `ANO-` diferente de 2021, e 13 deles são de OUTRA lei — 11 são a
 * Lei 14.113/2020 (FUNDEB) digitada como 14.133, e 2 são a lei municipal
 * 14.133/2006 de São Paulo. Cinco já estavam no acervo, visíveis e com
 * dispositivo amarrado.
 *
 * Os outros 9 são a Lei 14.133 de verdade, com o ano errado na origem — em
 * dois deles o próprio STF escreveu "lei 14.133/2001" e "Lei nº 14.133/22" na
 * ementa. Por isso a triagem NÃO é "exigir ANO-2021": ela derrubaria os 9.
 *
 * Ver `docs/audits/2026-08-19-verificacao-material-stf.md`.
 */

/** Lei municipal 14.133/2006 de São Paulo — ARE 1344624, bloco real da fonte. */
const STF_LEI_MUNICIPAL = `LEG-MUN   LEI-014133 ANO-2006
    ART-00019 PAR-00002
    LEI ORDINÁRIA  DO MUNICÍPIO DE SÃO PAULO, SP`;

/** Lei 14.113/2020 (FUNDEB) indexada como 14.133 — ARE 1474601, bloco real. */
const STF_FUNDEB_ANO_2020 = `LEG-FED   LEI-014133 ANO-2020
    ART-00020 ART-00021
    LEI ORDINÁRIA`;

/** Lei 14.133 com ano errado na origem — RE 1506564, bloco real. */
const STF_14133_ANO_2001 = `LEG-FED   LEI-014133 ANO-2001
    LEI ORDINÁRIA`;

/** Lei 14.133 com ano errado na origem — Rcl 96885, bloco real. */
const STF_14133_ANO_2022 = `LEG-FED   LEI-014133 ANO-2022
    ART-00121 PAR-00002
    LEI ORDINÁRIA`;

/** Sem `ANO-` nenhum — ARE 1542442, bloco real. */
const STF_14133_SEM_ANO = `LEG-FED   LEI-014133
    LEI ORDINÁRIA`;

describe('triagem: a esfera e o ano impossível separam a 14.133 de suas homônimas', () => {
  it('rejeita lei municipal de mesmo número — a Lei 14.133 é federal por definição', () => {
    expect(citaLei14133([STF_LEI_MUNICIPAL])).toBe(false);
    expect(extrairArtigos14133([STF_LEI_MUNICIPAL])).toEqual([]);
  });

  it('rejeita ANO-2020: impossível para lei sancionada em 01/04/2021 (é o FUNDEB)', () => {
    expect(citaLei14133([STF_FUNDEB_ANO_2020])).toBe(false);
    expect(extrairArtigos14133([STF_FUNDEB_ANO_2020])).toEqual([]);
  });

  it('aceita os demais anos errados: é a 14.133 com erro de digitação na origem', () => {
    expect(citaLei14133([STF_14133_ANO_2001])).toBe(true);
    expect(citaLei14133([STF_14133_ANO_2022])).toBe(true);
    expect(extrairArtigos14133([STF_14133_ANO_2022])).toEqual(['121']);
  });

  it('aceita bloco sem ANO — exigir o ano criaria falso negativo', () => {
    expect(citaLei14133([STF_14133_SEM_ANO])).toBe(true);
  });

  it('aceita bloco sem esfera declarada, por conservadorismo com o STJ', () => {
    // O STJ não persiste a legislação citada, então não dá para medir lá.
    // Rejeita-se só o que se declara NÃO-federal, nunca a ausência.
    expect(citaLei14133(['LEI-014133 ANO-2021\n ART-00075'])).toBe(true);
  });

  it('não deixa o bloco rejeitado contaminar o bloco bom ao lado', () => {
    expect(extrairArtigos14133([STF_FUNDEB_ANO_2020, STF_14133])).toEqual(['6', '75']);
  });
});

/**
 * A fonte do STF cola o sufixo no número: `ART-0337L`, não `ART-00184-A`.
 * Medido em 30/08/2026: das 10 ocorrências de sufixo na fonte, **10 vêm sem
 * hífen e nenhuma com** — o formato que a regex reconhecia não existe ali.
 * Resultado: `ART-0337L` virava artigo `337` e `ART-0005A` virava `5`, ambos
 * amarrados à Lei 14.133 como se fossem dispositivos dela.
 *
 * O campo tem largura fixa de 5: cinco dígitos, ou quatro dígitos e uma letra.
 */
describe('sufixo de artigo colado ao número, como o STF publica', () => {
  const bloco = (arts: string) => `LEG-FED   LEI-014133 ANO-2021\n    ${arts}\n    LEI ORDINÁRIA`;

  it('lê ART-0337L como 337-L, não como 337', () => {
    expect(extrairArtigos14133([bloco('ART-0337L INC-00004')])).toEqual(['337-L']);
  });

  it('lê ART-0005A como 5-A, não como 5', () => {
    expect(extrairArtigos14133([bloco('ART-0005A PAR-00003 ART-00121 PAR-00003')])).toEqual([
      '5-A',
      '121',
    ]);
  });

  it('lê ART-0004B como 4-B', () => {
    expect(extrairArtigos14133([bloco('ART-0004B')])).toEqual(['4-B']);
  });

  it('lê dois artigos com sufixo no mesmo bloco', () => {
    expect(extrairArtigos14133([bloco('ART-0377H ART-0377L')])).toEqual(['377-H', '377-L']);
  });

  it('continua lendo o formato com hífen, que os testes acima já cobriam', () => {
    expect(extrairArtigos14133([STF_14133_ART184A_MAIUSCULO])).toEqual(['184-A']);
  });

  it('não inventa sufixo em artigo sem letra', () => {
    expect(extrairArtigos14133([bloco('ART-00121 ART-00006')])).toEqual(['6', '121']);
  });
});
