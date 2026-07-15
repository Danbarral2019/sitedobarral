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

describe('antônimos não invertem o sinal (bug crítico)', () => {
  // Prova: "insegurança jurídica" 3x no voto cruzava o LIMIAR_DEBATIDO.fracoVoto
  // porque a regex antiga casava "segurança jurídica" como substring dentro do
  // antônimo. O termo positivo nunca foi dito — o artigo não pode ser marcado
  // como debatido, e a contagem do termo positivo deve ficar zerada/ausente.
  it('"insegurança jurídica" (3x) NÃO marca o art. 5º como debatido, nem conta em "segurança jurídica"', () => {
    const t = ['RELATÓRIO', 'nada', 'VOTO',
      'Há insegurança jurídica no caso. A insegurança jurídica persiste. Reitero: insegurança jurídica.',
      'ACÓRDÃO', 'ACORDAM.'].join('\n');
    const a = analisarAcordao(t, ['5']);
    expect(a.termos['5']?.['segurança jurídica']?.fraco.voto ?? 0).toBe(0);
    expect(artigosDebatidos(a)).not.toContain('5');
  });

  it('"ilegalidade" (3x) NÃO marca o art. 5º como debatido, nem conta em "legalidade"', () => {
    const t = ['RELATÓRIO', 'nada', 'VOTO',
      'Configurada a ilegalidade do ato. Trata-se de flagrante ilegalidade. A ilegalidade é patente.',
      'ACÓRDÃO', 'ACORDAM.'].join('\n');
    const a = analisarAcordao(t, ['5']);
    expect(a.termos['5']?.['legalidade']?.fraco.voto ?? 0).toBe(0);
    expect(artigosDebatidos(a)).not.toContain('5');
  });

  it.each([
    ['igualdade', 'desigualdade'],
    ['moralidade', 'imoralidade'],
    ['eficácia', 'ineficácia'],
    ['eficiência', 'ineficiência'],
    ['proporcionalidade', 'desproporcionalidade'],
    ['razoabilidade', 'irrazoabilidade'],
  ])('"%s" não é contado quando só o antônimo "%s" aparece (3x) no voto', (positivo, antonimo) => {
    const t = ['RELATÓRIO', 'nada', 'VOTO',
      `Há ${antonimo} evidente. Configura-se ${antonimo} no processo. Persiste a ${antonimo}.`,
      'ACÓRDÃO', 'ACORDAM.'].join('\n');
    const a = analisarAcordao(t, ['5']);
    expect(a.termos['5']?.[positivo]?.fraco.voto ?? 0).toBe(0);
    expect(artigosDebatidos(a)).not.toContain('5');
  });

  it('o termo positivo continua contando normalmente quando de fato aparece', () => {
    // "insegurança jurídica" 2x (não deve contar) + "segurança jurídica" 1x (deve contar)
    const t = ['RELATÓRIO', 'nada', 'VOTO',
      'Há insegurança jurídica no caso. Reitero a insegurança jurídica. Busca-se a segurança jurídica das relações.',
      'ACÓRDÃO', 'ACORDAM.'].join('\n');
    const a = analisarAcordao(t, ['5']);
    expect(a.termos['5']['segurança jurídica'].fraco.voto).toBe(1);
  });
});

describe('espaço flexível em termos multi-palavra (quebra de linha / espaço duplo)', () => {
  it('conta "segurança\\njurídica" (quebra de linha) e "vinculação  ao  edital" (espaço duplo)', () => {
    const t = ['RELATÓRIO', 'nada', 'VOTO',
      'Prevalece a segurança\njurídica do ato. Observada a vinculação  ao  edital no certame.',
      'ACÓRDÃO', 'ACORDAM.'].join('\n');
    const a = analisarAcordao(t, ['5']);
    expect(a.termos['5']['segurança jurídica'].fraco.voto).toBe(1);
    expect(a.termos['5']['vinculação ao edital'].fraco.voto).toBe(1);
  });
});
