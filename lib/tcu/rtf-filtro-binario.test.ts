import { describe, it, expect } from 'vitest';
import { FiltroGruposBinarios, descartarGruposBinarios } from './rtf-filtro-binario';

const filtrar = (s: string) => descartarGruposBinarios(Buffer.from(s, 'latin1')).toString('latin1');

describe('descartarGruposBinarios', () => {
  it('remove o grupo \\pict inteiro, com os subgrupos', () => {
    const rtf = String.raw`{\rtf1 Antes {\pict{\*\picprop{\sp{\sn a}{\sv 1}}}\pngblip 89504e47} depois\par}`;
    expect(filtrar(rtf)).toBe(String.raw`{\rtf1 Antes  depois\par}`);
  });

  it('remove destinos ignoráveis de imagem e objeto (\\*\\shppict, \\*\\objdata)', () => {
    const rtf = String.raw`{\rtf1 A{\*\shppict{\pict\wmetafile8 0100}}{\nonshppict{\pict 0200}}B{\object{\*\objdata 0105}{\result texto do objeto}}C}`;
    expect(filtrar(rtf)).toBe(String.raw`{\rtf1 AB{\object{\result texto do objeto}}C}`);
  });

  it('preserva grupos de texto, formatação e o destino ignorável que não é binário', () => {
    const rtf = String.raw`{\rtf1{\fonttbl{\f0\froman Times;}}{\b negrito}{\*\bkmkstart x}{\'e3o}\par}`;
    expect(filtrar(rtf)).toBe(rtf);
  });

  it('não confunde chaves escapadas nem a barra literal com grupos', () => {
    const rtf = String.raw`{\rtf1 chave \{ aberta {\pict 00\}11} barra \\{\b ok}}`;
    expect(filtrar(rtf)).toBe(String.raw`{\rtf1 chave \{ aberta  barra \\{\b ok}}`);
  });

  it('pula os bytes crus de \\binN, que podem conter chaves', () => {
    const rtf = '{\\rtf1 A{\\pict\\bin4 }{{}}B}';
    expect(filtrar(rtf)).toBe('{\\rtf1 AB}');
  });

  it('dá o mesmo resultado quando o arquivo chega em pedaços', () => {
    const rtf = String.raw`{\rtf1 Antes {\*\shppict{\pict\bin3 {}x 0a0b}} meio {\pict 0c} fim\par}`;
    const inteiro = filtrar(rtf);
    for (const tamanho of [1, 2, 3, 7]) {
      const f = new FiltroGruposBinarios();
      const buf = Buffer.from(rtf, 'latin1');
      for (let i = 0; i < buf.length; i += tamanho) f.push(buf.subarray(i, i + tamanho));
      expect(f.end().toString('latin1')).toBe(inteiro);
    }
  });

  it('conta os bytes de entrada e de saída', () => {
    const f = new FiltroGruposBinarios();
    f.push(Buffer.from(String.raw`{\rtf1 A{\pict 0011223344}}`, 'latin1'));
    expect(f.bytesEntrada).toBe(27);
    expect(f.bytesSaida).toBe(9);
    expect(f.end().toString('latin1')).toBe(String.raw`{\rtf1 A}`);
  });
});
