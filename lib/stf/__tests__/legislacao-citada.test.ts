// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extrairArtigos14133, citaLei14133 } from '../legislacao-citada';

// Blocos reais do campo documental_legislacao_citada_texto do STF.
const BLOCO_CF = `LEG-FED   CF ANO-1988
    ART-00001 ART-00022 INC-00001 INC-00027
    ART-00037 INC-00021
    CF-1988 CONSTITUIÇÃO FEDERAL`;

const BLOCO_14133 = `LEG-FED   LEI-014133 ANO-2021
    ART-00006 ART-00075 INC-00002
    LEI ORDINÁRIA`;

const BLOCO_14133_COM_LETRA = `LEG-FED   LEI-014133 ANO-2021
    ART-00184-A
    LEI ORDINÁRIA`;

describe('extrairArtigos14133', () => {
  it('extrai só os artigos do bloco da Lei 14.133, ignorando os da CF', () => {
    expect(extrairArtigos14133([BLOCO_CF, BLOCO_14133])).toEqual(['6', '75']);
  });

  it('remove os zeros à esquerda do formato ART-00075', () => {
    expect(extrairArtigos14133([BLOCO_14133])).toEqual(['6', '75']);
  });

  it('preserva o sufixo de letra (Art. 184-A)', () => {
    expect(extrairArtigos14133([BLOCO_14133_COM_LETRA])).toEqual(['184-A']);
  });

  it('NÃO captura incisos como se fossem artigos', () => {
    expect(extrairArtigos14133([BLOCO_14133])).not.toContain('2');
  });

  it('devolve vazio quando a 14.133 não é citada', () => {
    expect(extrairArtigos14133([BLOCO_CF])).toEqual([]);
  });

  it('aceita string única em vez de array', () => {
    expect(extrairArtigos14133(BLOCO_14133)).toEqual(['6', '75']);
  });

  it('aceita null e undefined', () => {
    expect(extrairArtigos14133(null)).toEqual([]);
    expect(extrairArtigos14133(undefined)).toEqual([]);
  });

  it('deduplica artigos repetidos', () => {
    expect(extrairArtigos14133([BLOCO_14133, BLOCO_14133])).toEqual(['6', '75']);
  });

  it('ordena numericamente, não alfabeticamente', () => {
    const bloco = 'LEG-FED   LEI-014133 ANO-2021\n ART-00100 ART-00020 ART-00003';
    expect(extrairArtigos14133([bloco])).toEqual(['3', '20', '100']);
  });
});

describe('citaLei14133', () => {
  it('reconhece o token da norma', () => {
    expect(citaLei14133([BLOCO_CF, BLOCO_14133])).toBe(true);
  });

  it('é falso quando só há outras normas', () => {
    expect(citaLei14133([BLOCO_CF])).toBe(false);
  });

  it('é falso para vazio', () => {
    expect(citaLei14133(null)).toBe(false);
    expect(citaLei14133([])).toBe(false);
  });
});
