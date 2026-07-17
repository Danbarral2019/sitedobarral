import { describe, it, expect } from 'vitest';
import { extractCitations, citesArticle } from './citation-extractor';

describe('extractCitations', () => {
  it('reconhece as formas usuais de citar', () => {
    const t = 'Conforme o art. 5º da Lei 14.133/2021 e o artigo 6 da mesma lei.';
    const arts = extractCitations(t).map((c) => c.article);
    expect(arts).toContain('5');
    expect(arts).toContain('6');
  });

  it('reconhece lista de artigos ("arts. 17 e 18")', () => {
    const arts = extractCitations('Vide arts. 17 e 18 da Lei 14.133.').map((c) => c.article);
    expect(arts).toEqual(expect.arrayContaining(['17', '18']));
  });

  it('reconhece artigo com letra (art. 184-A)', () => {
    const arts = extractCitations('O art. 184-A da Lei 14.133 dispõe...').map((c) => c.article);
    expect(arts).toContain('184-A');
  });

  it('não confunde art. 5 com art. 50 ou 55', () => {
    const arts = extractCitations('O art. 50 e o art. 55 da Lei 14.133...').map((c) => c.article);
    expect(arts).toContain('50');
    expect(arts).toContain('55');
    expect(arts).not.toContain('5');
  });

  it('descarta artigo que não existe na Lei (art. 999)', () => {
    const arts = extractCitations('O art. 999 da Lei 14.133...').map((c) => c.article);
    expect(arts).not.toContain('999');
  });

  it('marca proximidade com a 14.133', () => {
    const [c] = extractCitations('nos termos do art. 75 da Lei nº 14.133/2021');
    expect(c.nearLei14133).toBe(true);
  });

  it('marca quando a citação é de OUTRA lei', () => {
    const [c] = extractCitations('o art. 24 da Lei 8.666/93 previa dispensa');
    expect(c.nearOutraLei).toBe(true);
    expect(c.nearLei14133).toBe(false);
  });

  it('aceita "14133" sem ponto', () => {
    const [c] = extractCitations('art. 75 da Lei 14133');
    expect(c.nearLei14133).toBe(true);
  });

  it('não quebra com texto vazio ou nulo', () => {
    expect(extractCitations('')).toEqual([]);
    expect(extractCitations(null as unknown as string)).toEqual([]);
  });

  it('é reentrante (regex global não vaza lastIndex entre chamadas)', () => {
    const t = 'art. 5º da Lei 14.133';
    expect(extractCitations(t)).toHaveLength(extractCitations(t).length);
    expect(extractCitations(t).length).toBeGreaterThan(0);
  });
});

describe('citesArticle', () => {
  const LEI = 'Aplica-se o art. 5º da Lei 14.133/2021 aos contratos.';
  const OUTRA = 'Aplica-se o art. 5º da Lei 8.666/93 aos contratos.';
  const TEMA = 'O acórdão trata dos princípios da Administração Pública e da isonomia.';

  it('confirma citação quando o artigo aparece perto da 14.133', () => {
    const r = citesArticle(LEI, '5');
    expect(r.cites).toBe(true);
    expect(r.mentions).toBe(1);
  });

  it('NÃO confirma quando o artigo é de outra lei', () => {
    expect(citesArticle(OUTRA, '5').cites).toBe(false);
  });

  it('NÃO confirma quando o texto só trata do tema', () => {
    const r = citesArticle(TEMA, '5');
    expect(r.cites).toBe(false);
    expect(r.mentions).toBe(0);
  });

  it('conta múltiplas menções', () => {
    const t = 'O art. 5º da Lei 14.133 traz princípios. Ainda sobre o art. 5º da Lei 14.133, veja-se...';
    expect(citesArticle(t, '5').mentions).toBe(2);
  });

  it('não confunde artigos diferentes', () => {
    expect(citesArticle(LEI, '6').cites).toBe(false);
  });

  it('trata texto nulo', () => {
    const r = citesArticle(null, '5');
    expect(r.cites).toBe(false);
    expect(r.mentions).toBe(0);
  });

  it('marca ambíguo quando cita o artigo sem lei identificável por perto', () => {
    // Caso real: acórdão que diz "violação ao art. 5º" sem repetir a lei.
    const r = citesArticle('Houve violação ao art. 5º, caput, no julgamento.', '5');
    expect(r.cites).toBe(false);
    expect(r.ambiguous).toBe(true);
  });
});

describe('amarração à norma (a ligação imediata vence a proximidade)', () => {
  // Um "art. N" seguido de "da/do ‹outra norma›" pertence àquela norma, mesmo
  // que "14.133" apareça na janela — em geral de uma citação vizinha legítima.
  // Casos reais do acervo TCU (inteiro teor).

  it('art. amarrado à Resolução-TCU não conta como 14.133, mesmo com a 14.133 por perto', () => {
    // Acórdão 183/2026: o art. 103 é da Resolução-TCU 259; o "14.133" ao lado
    // vem do art. 170 — citação vizinha e genuína.
    const t =
      'conheço da representação com fundamento no art. 103, § 1º, da Resolução-TCU 259/2014 e no art. 170, § 4º, da Lei 14.133/2021.';
    expect(citesArticle(t, '103').cites).toBe(false);
    expect(citesArticle(t, '170').cites).toBe(true); // a ligação legítima é preservada
  });

  it('art. amarrado ao Regimento Interno não conta como 14.133', () => {
    // Padrão do art. 169 (20 acórdãos): "art. 169 do Regimento Interno do TCU".
    const t =
      'nos termos do art. 169 do Regimento Interno do TCU, aplica-se subsidiariamente a Lei 14.133/2021.';
    expect(citesArticle(t, '169').cites).toBe(false);
  });

  it('art. amarrado a outra Lei (8.666) não conta, ainda que a 14.133 venha depois', () => {
    const t = 'o art. 30 da Lei 8.666/93, cujo teor foi mantido pela Lei 14.133/2021, exigia atestados.';
    expect(citesArticle(t, '30').cites).toBe(false);
  });

  it('a citação genuína da 14.133 no mesmo texto continua contando', () => {
    const t = 'o art. 59, caput, da Lei 14.133/2021 impõe a desclassificação da proposta.';
    expect(citesArticle(t, '59').cites).toBe(true);
  });

  it('extractCitations marca boundToOtherNorm só na ocorrência amarrada a outra norma', () => {
    const cs = extractCitations(
      'o art. 103, § 1º, da Resolução-TCU 259/2014 e o art. 170 da Lei 14.133/2021'
    );
    expect(cs.find((c) => c.article === '103')?.boundToOtherNorm).toBe(true);
    expect(cs.find((c) => c.article === '170')?.boundToOtherNorm).toBe(false);
  });
});
