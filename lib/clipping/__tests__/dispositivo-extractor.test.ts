// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { rtfToText } from '../dispositivo-extractor';

describe('rtfToText', () => {
  it('remove control words e normaliza espaços', () => {
    expect(rtfToText('\\b Olá\\b0 mundo')).toBe('Olá mundo');
  });

  it('remove destination groups {\\*\\...} (bookmarks, fldinst)', () => {
    expect(rtfToText('{\\*\\bkmkstart _Hlk123}Texto{\\*\\bkmkend _Hlk123}')).toBe('Texto');
  });

  it('converte hex escapes latin1 (\\\'e9 → é)', () => {
    expect(rtfToText("caf\\'e9")).toBe('café');
  });

  it('mapeia hex escapes específicos do cp1252 (aspas curvas \\\'93/\\\'94)', () => {
    expect(rtfToText("\\'93texto\\'94")).toBe('“texto”');
  });

  it('converte unicode escapes \\uNNNN? para o caractere', () => {
    expect(rtfToText('caf\\u233? ')).toBe('café');
  });

  it('resolve unicode negativo (signed int16) somando 65536', () => {
    // \u-57319 e 舗 apontam para o mesmo code point (’ U+2019): 8217 - 65536 = -57319
    expect(rtfToText('\\u-57319?')).toBe(rtfToText('\\u8217?'));
  });

  it('trata symbol escapes: \\~ (espaço), \\_ (hífen), \\: (dois-pontos)', () => {
    expect(rtfToText('a\\~b')).toBe('a b');
    expect(rtfToText('a\\_b')).toBe('a-b');
    expect(rtfToText('a\\:b')).toBe('a:b');
  });

  it('as chaves literais escapadas acabam removidas (strip final de chaves)', () => {
    // Comportamento atual: \{ e \} são desescapados mas depois o strip de chaves
    // restantes os apaga — resultado sem as chaves.
    expect(rtfToText('\\{chave\\}')).toBe('chave');
  });
});
