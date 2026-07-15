import { describe, it, expect } from 'vitest';
import { seccionarAcordao, secaoDe } from './seccionar-acordao';

const ACORDAO = [
  'TRIBUNAL DE CONTAS DA UNIÃO',        // cabeçalho
  'ACÓRDÃO Nº 1135/2026 - TCU - Plenário', // ⚠️ "ACÓRDÃO" aparece AQUI também
  'Natureza: Representação.',
  'RELATÓRIO',
  'A representante alega violação ao julgamento objetivo.',
  'VOTO',
  'Acolho. O julgamento objetivo foi desrespeitado.',
  'ACÓRDÃO',
  'Os Ministros ACORDAM em conhecer.',
].join('\n');

describe('seccionarAcordao', () => {
  it('acha as três seções', () => {
    const s = seccionarAcordao(ACORDAO)!;
    expect(s.relatorio).not.toBeNull();
    expect(s.voto).not.toBeNull();
    expect(s.acordao).not.toBeNull();
  });

  it('usa a ÚLTIMA ocorrência de ACÓRDÃO (a 1ª é o cabeçalho)', () => {
    const s = seccionarAcordao(ACORDAO)!;
    // O dispositivo vem depois do voto, não no início do documento.
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
