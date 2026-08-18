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
