import { describe, it, expect } from 'vitest';
import { seccionarAcordao, secaoDe } from './seccionar-acordao';

// Formato REAL (confirmado no Acórdão 1135/2026 do TCU): não há cabeçalho
// "ACÓRDÃO Nº ..." antes do Relatório — o documento começa direto no
// cabeçalho do tribunal/processo e vai para RELATÓRIO. O dispositivo, ao
// final, é sempre "ACÓRDÃO Nº <num>/<ano> – TCU – <colegiado>" (com o
// travessão en dash "–", não hífen) — nunca a palavra isolada "ACÓRDÃO".
const ACORDAO = [
  'TRIBUNAL DE CONTAS DA UNIÃO',        // cabeçalho
  'Natureza: Representação.',
  'RELATÓRIO',
  'A representante alega violação ao julgamento objetivo.',
  'VOTO',
  'Acolho. O julgamento objetivo foi desrespeitado.',
  'ACÓRDÃO Nº 1135/2026 – TCU – Plenário',
  'Os Ministros ACORDAM em conhecer.',
].join('\n');

describe('seccionarAcordao', () => {
  it('acha as três seções', () => {
    const s = seccionarAcordao(ACORDAO)!;
    expect(s.relatorio).not.toBeNull();
    expect(s.voto).not.toBeNull();
    expect(s.acordao).not.toBeNull();
  });

  it('o dispositivo (ACÓRDÃO Nº ...) vem depois do voto', () => {
    const s = seccionarAcordao(ACORDAO)!;
    expect(s.acordao![0]).toBeGreaterThan(s.voto![0]);
  });

  it('as seções são contíguas e em ordem', () => {
    const s = seccionarAcordao(ACORDAO)!;
    expect(s.relatorio![1]).toBe(s.voto![0]);
    expect(s.voto![1]).toBe(s.acordao![0]);
  });

  it('acórdão curto sem seções devolve null (caso legítimo, não erro)', () => {
    // O de 2.247 chars do spike: só dispositivo, sem relatório nem voto.
    expect(seccionarAcordao('ACÓRDÃO Nº 3796/2024\nOs Ministros ACORDAM em aplicar multa.')).toBeNull();
  });

  it('texto vazio devolve null', () => {
    expect(seccionarAcordao('')).toBeNull();
  });

  it('citação de outro acórdão dentro do voto, com prefixo, não é confundida com o dispositivo', () => {
    // "Conforme o ACÓRDÃO Nº ..." está em linha própria, mas não é a linha
    // INTEIRA (tem prefixo antes de "ACÓRDÃO") — não pode disparar o
    // marcador do dispositivo. Só a linha 100% "ACÓRDÃO Nº ..." conta.
    const texto = [
      'RELATÓRIO',
      'A representante alega violação ao julgamento objetivo.',
      'VOTO',
      'Acolho o entendimento.',
      'Conforme o ACÓRDÃO Nº 1211/2021 – TCU – Plenário, decido.',
      'Isso não altera a conclusão.',
      'ACÓRDÃO Nº 1135/2026 – TCU – Plenário',
      'Os Ministros ACORDAM em conhecer.',
    ].join('\n');

    const s = seccionarAcordao(texto)!;
    expect(s.acordao).not.toBeNull();
    // O dispositivo tem que começar na linha "ACÓRDÃO Nº 1135/2026 ...",
    // não na citação "Conforme o ACÓRDÃO Nº 1211/2021 ...".
    expect(s.acordao![0]).toBe(texto.indexOf('ACÓRDÃO Nº 1135/2026'));
    // A citação continua dentro do voto.
    expect(secaoDe(s, texto.indexOf('Conforme o ACÓRDÃO'))).toBe('voto');
  });

  it('dois blocos ACÓRDÃO Nº após o voto: usa o último (dispositivo real)', () => {
    // Um voto pode transcrever/citar acórdão anterior em bloco próprio; o
    // dispositivo de fato é sempre o ÚLTIMO bloco "ACÓRDÃO Nº ..." do texto.
    const texto = [
      'RELATÓRIO',
      'A representante alega violação.',
      'VOTO',
      'Cito precedente análogo:',
      'ACÓRDÃO Nº 1211/2021 – TCU – Plenário',
      'Os Ministros ACORDAM, à época, em conhecer.',
      'Diante disso, VOTO por que seja adotado o seguinte acórdão.',
      'ACÓRDÃO Nº 1135/2026 – TCU – Plenário',
      'Os Ministros ACORDAM em conhecer.',
    ].join('\n');

    const s = seccionarAcordao(texto)!;
    expect(s.acordao).not.toBeNull();
    expect(s.acordao![0]).toBe(texto.lastIndexOf('ACÓRDÃO Nº 1135/2026'));
  });
});

describe('secaoDe', () => {
  const s = seccionarAcordao(ACORDAO)!;

  it('localiza uma posição no relatório', () => {
    expect(secaoDe(s, ACORDAO.indexOf('A representante alega'))).toBe('relatorio');
  });

  it('localiza uma posição no voto', () => {
    expect(secaoDe(s, ACORDAO.indexOf('Acolho.'))).toBe('voto');
  });

  it('localiza uma posição no dispositivo', () => {
    expect(secaoDe(s, ACORDAO.indexOf('Os Ministros ACORDAM'))).toBe('acordao');
  });

  it('posição no cabeçalho (antes do relatório) não é de seção nenhuma', () => {
    expect(secaoDe(s, 0)).toBeNull();
  });

  it('secoes null → null', () => {
    expect(secaoDe(null, 10)).toBeNull();
  });
});
