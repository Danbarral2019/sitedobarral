import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { removerTextoRiscado } from '../texto-riscado';
import { PlanaltoScraper } from '../planalto';
import { blockAwareText, collapseWhitespace } from '../normalize';

function texto(html: string): string {
  const $ = cheerio.load(html);
  removerTextoRiscado($);
  return collapseWhitespace(blockAwareText($.root()));
}

describe('removerTextoRiscado', () => {
  it('tira a redação antiga e mantém a vigente com a nota (Lei 10.973/2004, art. 2º, III)', () => {
    const out = texto(`
      <p>Art. 2º Para os efeitos desta Lei, considera-se:</p>
      <p><strike>III - criador: pesquisador que seja inventor, obtentor ou autor de criação;</strike></p>
      <p>III - criador: pessoa física que seja inventora, obtentora ou autora de criação; <a href="#">(Redação pela Lei nº 13.243, de 2016)</a></p>`);
    expect(out).not.toContain('pesquisador que seja inventor');
    expect(out).toContain('III - criador: pessoa física');
    expect(out.match(/III - criador/g)).toHaveLength(1);
  });

  it('dispositivo revogado fica só com o rótulo e a nota (Lei 8.666/1993, art. 3º, § 2º, I)', () => {
    const out = texto(`
      <p>§ 2º Em igualdade de condições, será assegurada preferência, sucessivamente, aos bens e serviços:</p>
      <p><strike>I - produzidos ou prestados por empresas brasileiras de capital nacional;</strike> <a href="#">(Revogado pela Lei nº 12.349, de 2010)</a></p>
      <p>II - produzidos no País;</p>`);
    expect(out).toContain('I - (Revogado pela Lei nº 12.349, de 2010)');
    expect(out).not.toContain('capital nacional');
    expect(out).toContain('II - produzidos no País;');
  });

  it('artigo inteiro riscado sem nota sai do texto', () => {
    const out = texto('<p><strike>Art. 1º Esta Lei estabelece medidas antigas.</strike></p><p>Art. 1º Esta Lei estabelece medidas novas.</p>');
    expect(out).toBe('Art. 1º Esta Lei estabelece medidas novas.');
  });

  it('reconhece <s>, <del> e estilo line-through', () => {
    const out = texto(`
      <p><s>a) alínea antiga;</s></p>
      <p><del>b) outra antiga;</del></p>
      <p><span style="text-decoration: line-through">c) mais uma;</span></p>
      <p>a) alínea vigente;</p>`);
    expect(out).toBe('a) alínea vigente;');
  });

  it('trecho riscado no meio do parágrafo sai sem levar o resto', () => {
    const out = texto('<p>§ 1º Texto vigente <strike>com acréscimo revogado</strike> e final.</p>');
    expect(out).toBe('§ 1º Texto vigente e final.');
  });

  it('sem riscado, nada muda', () => {
    const $ = cheerio.load('<p>Art. 1º Texto.</p>');
    expect(removerTextoRiscado($)).toBe(0);
  });
});

describe('PlanaltoScraper: texto riscado', () => {
  const extract = (html: string) => (new PlanaltoScraper() as any).extractContent(html) as string;

  it('extrai o compilado sem a redação superada', () => {
    const out = extract(`<html><body>
      <p>LEI Nº 10.973, DE 2 DE DEZEMBRO DE 2004</p>
      <p><strike>Art. 1º Esta Lei estabelece medidas de incentivo, nos termos dos arts. 218 e 219 da Constituição.</strike></p>
      <p>Art. 1º Esta Lei estabelece medidas de incentivo, nos termos dos arts. 23, 24, 167, 200, 213, 218, 219 e 219-A da Constituição Federal. <a>(Redação pela Lei nº 13.243, de 2016)</a></p>
    </body></html>`);
    expect(out.match(/Art\. 1º/g)).toHaveLength(1);
    expect(out).toContain('219-A');
  });

  it('ato com o corpo inteiro riscado conserva o texto histórico', () => {
    const corpo = Array.from({ length: 10 }, (_, i) => `<p><strike>Art. ${i + 1}. Texto revogado do artigo ${i + 1} com conteúdo suficiente.</strike></p>`).join('');
    const out = extract(`<html><body><p>DECRETO Nº 1, DE 1º DE JANEIRO DE 1990</p>${corpo}</body></html>`);
    expect(out).toContain('Art. 10. Texto revogado');
  });
});
