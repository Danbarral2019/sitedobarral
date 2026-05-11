// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { rtfToText } from '@/lib/clipping/dispositivo-extractor';

describe('rtfToText — sanitização de destination groups', () => {
  it('remove bookmarks Word ({\\*\\bkmkstart Hlk...}) sem deixar o nome do bookmark', () => {
    const rtf = `{\\rtf1\\ansi texto antes {\\*\\bkmkstart _Hlk225536710}meio{\\*\\bkmkend _Hlk225536710} texto depois}`;
    const out = rtfToText(rtf);
    expect(out).not.toMatch(/_Hlk/);
    expect(out).not.toMatch(/bkmkstart/);
    expect(out).not.toMatch(/bkmkend/);
    expect(out).toMatch(/texto antes/);
    expect(out).toMatch(/meio/);
    expect(out).toMatch(/texto depois/);
  });

  it('remove hyperlink field instructions ({\\*\\fldinst HYPERLINK ...})', () => {
    const rtf = `{\\rtf1 antes {\\*\\fldinst HYPERLINK "http://example.com"} depois}`;
    const out = rtfToText(rtf);
    expect(out).not.toMatch(/HYPERLINK/);
    expect(out).not.toMatch(/fldinst/);
    expect(out).toMatch(/antes/);
    expect(out).toMatch(/depois/);
  });

  it('regressão: caso real reportado no clipping de 11/05/2026', () => {
    // Trecho extraído do email reportado: "...IN-TCU 91/2022, \* _Hlk225536710 sugerir..."
    // significa que o RTF original tinha {\*\bkmkstart _Hlk225536710}sugerir{...}
    const rtf = `{\\rtf1 IN-TCU 91/2022, {\\*\\bkmkstart _Hlk225536710}sugerir aprimoramento}`;
    const out = rtfToText(rtf);
    expect(out).not.toMatch(/\\\*/);
    expect(out).not.toMatch(/_Hlk\d+/);
    expect(out).toMatch(/IN-TCU 91\/2022/);
    expect(out).toMatch(/sugerir aprimoramento/);
  });

  it('preserva texto comum e acentos cp1252', () => {
    // \'e7 = ç, \'e3 = ã em cp1252
    const rtf = `{\\rtf1 decis\\'e3o e revoga\\'e7\\'e3o}`;
    const out = rtfToText(rtf);
    expect(out).toMatch(/decisão/);
    expect(out).toMatch(/revogação/);
  });
});
