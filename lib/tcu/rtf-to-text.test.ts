import { describe, it, expect } from 'vitest';
import { rtfToText } from './rtf-to-text';

/** RTF mínimo no formato que o TCU emite (cp1252, \'e3 = ã). */
const RTF_SIMPLES = String.raw`{\rtf1\ansi\ansicpg1252\deff0
{\fonttbl{\f0\froman Times;}}
\pard TRIBUNAL DE CONTAS DA UNI\'c3O\par
\pard RELAT\'d3RIO\par
\pard Cuidam os autos de representa\'e7\'e3o.\par
\pard VOTO\par
\pard Acolho o parecer, por viola\'e7\'e3o ao princ\'edpio da economicidade.\par
\pard AC\'d3RD\'c3O\par
\pard Os Ministros ACORDAM em conhecer.\par
}`;

/** Parágrafo que é dump hexadecimal de imagem embutida (EMF/WMF). */
const HEX = '0100'.repeat(40); // 160 chars, 100% hex
const RTF_COM_IMAGEM = String.raw`{\rtf1\ansi\ansicpg1252\deff0
\pard ${HEX}\par
\pard Texto de verdade aqui.\par
}`;

describe('rtfToText', () => {
  it('extrai o texto com acentuação cp1252 correta', async () => {
    const t = await rtfToText(Buffer.from(RTF_SIMPLES, 'latin1'));
    expect(t).toContain('TRIBUNAL DE CONTAS DA UNIÃO');
    expect(t).toContain('representação');
    expect(t).toContain('princípio da economicidade');
  });

  it('NÃO quebra palavras no meio (bug do extrator ingênuo: UNIÃ\\nO)', async () => {
    const t = await rtfToText(Buffer.from(RTF_SIMPLES, 'latin1'));
    expect(t).toMatch(/UNIÃO/);
    expect(t).not.toMatch(/UNIÃ\s*\n\s*O/);
  });

  it('preserva as quebras de parágrafo (o seccionamento depende delas)', async () => {
    const t = await rtfToText(Buffer.from(RTF_SIMPLES, 'latin1'));
    expect(t.split('\n').length).toBeGreaterThan(3);
  });

  it('não deixa control word nem lixo de metadados', async () => {
    const t = await rtfToText(Buffer.from(RTF_SIMPLES, 'latin1'));
    expect(t).not.toMatch(/\\[a-z]{2,}\d*/);
    expect(t).not.toMatch(/shapeType|fFlipH|pictureGray|fonttbl/);
  });

  it('descarta o dump hexadecimal das imagens embutidas', async () => {
    const t = await rtfToText(Buffer.from(RTF_COM_IMAGEM, 'latin1'));
    expect(t).toContain('Texto de verdade aqui.');
    expect(t).not.toContain(HEX);
  });

  it('mantém texto legítimo que por acaso tem hex curto', async () => {
    const rtf = String.raw`{\rtf1\ansi\deff0 \pard Processo TC 024.321/2025-7 abcdef.\par}`;
    const t = await rtfToText(Buffer.from(rtf, 'latin1'));
    expect(t).toContain('Processo TC 024.321/2025-7 abcdef.');
  });

  it('rejeita RTF inválido com erro claro', async () => {
    await expect(rtfToText(Buffer.from('não é rtf', 'latin1'))).rejects.toThrow();
  });
});
