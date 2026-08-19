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
