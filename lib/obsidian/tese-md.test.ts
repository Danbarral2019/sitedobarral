// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { caminhoTese, gerarTeseMd, type DestilacaoParaExport } from './tese-md';

const base: DestilacaoParaExport = {
  id: 'd1',
  numeroAlvo: 1441,
  anoAlvo: 2016,
  colegiadoAlvo: 'Plenário',
  relatorAlvo: 'Min. Fulano',
  acordaoKey: 'ACORDAO-COMPLETO-123',
  urlAlvo: 'https://pesquisa.apps.tcu.gov.br/documento/acordao-completo-123',
  origemIdentidade: 'tcu-oficial',
  citantesConcordantes: null,
  assunto: 'Prescrição da pretensão punitiva',
  confianca: 'alta',
  dossieNoVoto: 262,
  atualizadoEm: new Date('2026-09-04T12:00:00Z'),
  enunciados: [
    {
      id: 'e1',
      enunciado: 'A pretensão punitiva subordina-se ao prazo de dez anos.',
      inovacao: 'Fixou o prazo geral.',
      veredito: 'fiel',
      publicado: true,
      trechos: [
        {
          ordem: 0,
          trecho: 'Conforme o Acórdão 1441/2016, o prazo é decenal.',
          origemNumero: 100,
          origemAno: 2020,
          origemColegiado: 'Plenário',
          origemUrl: 'https://u/100',
          origemLinkPDF: null,
          noVoto: true,
        },
      ],
    },
  ],
};

describe('caminhoTese', () => {
  it('inclui o colegiado quando conhecido', () => {
    expect(caminhoTese(base)).toBe('teses/acordao-1441-2016-plenario.md');
  });

  it('omite o colegiado no nível 3 — não afirma no nome o que não afirma no corpo', () => {
    const semColegiado = { ...base, colegiadoAlvo: null, acordaoKey: null, origemIdentidade: null };
    expect(caminhoTese(semColegiado)).toBe('teses/acordao-1441-2016.md');
  });
});

describe('gerarTeseMd — frontmatter por nível', () => {
  it('nível 1 traz acordaoKey, fonteOficial e colegiado', () => {
    const md = gerarTeseMd(base);
    expect(md).toContain('origemIdentidade: tcu-oficial');
    expect(md).toContain('acordaoKey: ACORDAO-COMPLETO-123');
    expect(md).toContain('fonteOficial: https://pesquisa.apps.tcu.gov.br/documento/acordao-completo-123');
    expect(md).toContain('colegiado: "Plenário"');
  });

  it('nível 2 traz colegiado e citantesConcordantes, sem chave oficial', () => {
    const md = gerarTeseMd({
      ...base,
      acordaoKey: null,
      urlAlvo: null,
      origemIdentidade: 'convergencia-citantes',
      colegiadoAlvo: 'Segunda Câmara',
      citantesConcordantes: 23,
    });
    expect(md).toContain('origemIdentidade: convergencia-citantes');
    expect(md).toContain('colegiado: "Segunda Câmara"');
    expect(md).toContain('citantesConcordantes: 23');
    expect(md).not.toContain('acordaoKey:');
    expect(md).not.toContain('fonteOficial:');
  });

  it('nível 3 não afirma colegiado algum', () => {
    const md = gerarTeseMd({
      ...base, acordaoKey: null, urlAlvo: null, colegiadoAlvo: null, origemIdentidade: null,
    });
    expect(md).not.toContain('colegiado:');
    expect(md).not.toContain('acordaoKey:');
    expect(md).not.toContain('origemIdentidade:');
  });

  it('fonteSite só aparece quando alguma tese está publicada', () => {
    expect(gerarTeseMd(base)).toContain('fonteSite: https://profbarral.com.br/teses/1441-2016-plenario');
    const naoPublicada = { ...base, enunciados: [{ ...base.enunciados[0], publicado: false }] };
    expect(gerarTeseMd(naoPublicada)).not.toContain('fonteSite:');
  });
});

describe('gerarTeseMd — corpo', () => {
  it('traz o enunciado, a inovação e o trecho com o citante identificado', () => {
    const md = gerarTeseMd(base);
    expect(md).toContain('A pretensão punitiva subordina-se ao prazo de dez anos.');
    expect(md).toContain('Fixou o prazo geral.');
    expect(md).toContain('Conforme o Acórdão 1441/2016, o prazo é decenal.');
    expect(md).toContain('100/2020');
  });

  it('liga o trecho ao inteiro teor do citante quando há URL', () => {
    expect(gerarTeseMd(base)).toContain('https://u/100');
  });
});
