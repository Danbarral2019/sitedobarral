import { describe, it, expect } from 'vitest';
import { analisarAcordao, artigosDebatidos, ANALISE_VERSAO } from './analise-relevancia';

const TEXTO = [
  'TRIBUNAL DE CONTAS DA UNIÃO',
  'ACÓRDÃO Nº 1135/2026 - TCU - Plenário',
  'RELATÓRIO',
  'A representante alega ofensa à economicidade do certame.',
  'VOTO',
  'O princípio da economicidade foi desrespeitado.',
  'A economicidade exige a proposta mais vantajosa.',
  'Reitero: economicidade não se presume.',
  'Cito ainda o art. 15 da Lei 14.133.',
  'ACÓRDÃO',
  'Os Ministros ACORDAM em conhecer.',
].join('\n');

describe('analisarAcordao', () => {
  const a = analisarAcordao(TEXTO, ['5', '15']);

  it('carimba versão, tamanho e data', () => {
    expect(a.v).toBe(ANALISE_VERSAO);
    expect(a.chars).toBe(TEXTO.length);
    expect(a.extraidoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('conta "princípio da X" como FORTE, no voto', () => {
    expect(a.termos['5']['economicidade'].forte.voto).toBe(1);
  });

  it('conta o termo nu como FRACO — inclusive dentro da forma forte', () => {
    // "princípio da economicidade" + 2 nus = 3 no voto
    expect(a.termos['5']['economicidade'].fraco.voto).toBe(3);
  });

  it('separa por seção: o relatório é alegação da parte, não fundamento', () => {
    expect(a.termos['5']['economicidade'].fraco.relatorio).toBe(1);
    expect(a.termos['5']['economicidade'].forte.relatorio).toBeUndefined();
  });

  it('não inventa termo que não aparece', () => {
    expect(a.termos['5']['celeridade']).toBeUndefined();
  });

  it('registra citação de artigo por seção', () => {
    expect(a.artigosCitados['15'].voto).toBe(1);
  });

  it('só analisa termos dos artigos vinculados', () => {
    expect(Object.keys(a.termos)).toEqual(['5']);
  });

  it('texto sem seções: analisa sem quebrar', () => {
    const x = analisarAcordao('ACÓRDÃO Nº 1/2024\nMulta aplicada.', ['5']);
    expect(x.secoes).toBeNull();
    expect(x.termos).toEqual({});
  });

  it('propaga a marca de truncagem', () => {
    expect(analisarAcordao(TEXTO, ['5'], { truncado: true }).truncado).toBe(true);
  });
});

describe('artigosDebatidos', () => {
  it('entra quando o princípio é NOMEADO no voto (forte >= 1)', () => {
    const a = analisarAcordao(TEXTO, ['5']);
    expect(artigosDebatidos(a)).toContain('5');
  });

  it('entra quando o termo se repete no voto (fraco >= 3), mesmo sem forma forte', () => {
    const t = ['RELATÓRIO', 'nada', 'VOTO',
      'A celeridade importa. Sem celeridade não há certame. Reitero a celeridade.',
      'ACÓRDÃO', 'ACORDAM.'].join('\n');
    const a = analisarAcordao(t, ['5']);
    expect(a.termos['5']['celeridade'].forte.voto).toBeUndefined();
    expect(a.termos['5']['celeridade'].fraco.voto).toBe(3);
    expect(artigosDebatidos(a)).toContain('5');
  });

  it('NÃO entra com menção ornamental (1 fraco no voto)', () => {
    const t = ['RELATÓRIO', 'nada', 'VOTO', 'Observada a celeridade, decido.', 'ACÓRDÃO', 'ACORDAM.'].join('\n');
    expect(artigosDebatidos(analisarAcordao(t, ['5']))).toEqual([]);
  });

  it('NÃO entra se o princípio só aparece no relatório (alegação da parte)', () => {
    const t = ['RELATÓRIO',
      'A parte alega celeridade, celeridade e mais celeridade.',
      'VOTO', 'Rejeito por outros motivos.', 'ACÓRDÃO', 'ACORDAM.'].join('\n');
    expect(artigosDebatidos(analisarAcordao(t, ['5']))).toEqual([]);
  });
});
