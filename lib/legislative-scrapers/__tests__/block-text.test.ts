// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { blockAwareText } from '../normalize';

/**
 * Regressão: `el.text()` do Cheerio concatena o texto de TODOS os nós
 * descendentes sem separador, fundindo elementos de bloco irmãos.
 *
 * Efeito observado em produção na IN SEGES/MGI 382/2025:
 *   "CAPÍTULO IDISPOSIÇÕES PRELIMINARES"
 *   "Objeto e âmbito de aplicaçãoArt. 1º Esta Instrução Normativa..."
 *   "...do licitante;II - ações de promoção..."
 *
 * O texto fundido depois é renderizado por formatLegalContent, que trabalha
 * por linha — o `## ` do CAPÍTULO acaba engolindo o art. 1º inteiro.
 */
describe('blockAwareText', () => {
  it('não funde <p> irmãos (caso CAPÍTULO + subtítulo)', () => {
    const $ = cheerio.load('<div id="c"><p>CAPÍTULO I</p><p>DISPOSIÇÕES PRELIMINARES</p></div>');
    const out = blockAwareText($('#c'));
    expect(out).not.toContain('CAPÍTULO IDISPOSIÇÕES');
    expect(out).toMatch(/CAPÍTULO I\s*\n/);
    expect(out).toContain('DISPOSIÇÕES PRELIMINARES');
  });

  it('não funde subtítulo com o artigo seguinte', () => {
    const $ = cheerio.load(
      '<div id="c"><p>Objeto e âmbito de aplicação</p><p>Art. 1º Esta Instrução Normativa dispõe.</p></div>'
    );
    const out = blockAwareText($('#c'));
    expect(out).not.toContain('aplicaçãoArt.');
    expect(out).toMatch(/aplicação\s*\n[\s\S]*Art\. 1º/);
  });

  it('não funde incisos consecutivos', () => {
    const $ = cheerio.load(
      '<div id="c"><p>I - medidas de inserção do licitante;</p><p>II - ações de promoção;</p><p>III - igualdade de remuneração.</p></div>'
    );
    const out = blockAwareText($('#c'));
    expect(out).not.toContain('licitante;II');
    expect(out).not.toContain('promoção;III');
    expect(out.split('\n').filter(l => l.trim().startsWith('I')).length).toBeGreaterThanOrEqual(3);
  });

  it('quebra em <br>', () => {
    const $ = cheerio.load('<div id="c">linha um<br>linha dois</div>');
    const out = blockAwareText($('#c'));
    expect(out).not.toContain('linha umlinha dois');
  });

  it('quebra em <li> e <tr>', () => {
    const $ = cheerio.load('<div id="c"><ul><li>alfa</li><li>beta</li></ul></div>');
    expect(blockAwareText($('#c'))).not.toContain('alfabeta');

    const $2 = cheerio.load('<div id="c"><table><tr><td>um</td></tr><tr><td>dois</td></tr></table></div>');
    expect(blockAwareText($2('#c'))).not.toContain('umdois');
  });

  it('NÃO quebra em elementos inline dentro do mesmo parágrafo', () => {
    const $ = cheerio.load('<div id="c"><p>o art. 16, <em>caput</em>, incisos VI e VII</p></div>');
    const out = blockAwareText($('#c')).trim();
    expect(out).toBe('o art. 16, caput, incisos VI e VII');
  });

  it('não muta o documento — chamadas repetidas são idempotentes', () => {
    const $ = cheerio.load('<div id="c"><p>um</p><p>dois</p></div>');
    const a = blockAwareText($('#c'));
    const b = blockAwareText($('#c'));
    expect(a).toBe(b);
    expect($('#c').html()).toBe('<p>um</p><p>dois</p>');
  });

  it('preserva o texto integral (nada some)', () => {
    const $ = cheerio.load('<div id="c"><p>Art. 1º Alfa.</p><p>Art. 2º Beta.</p></div>');
    const out = blockAwareText($('#c'));
    expect(out).toContain('Art. 1º Alfa.');
    expect(out).toContain('Art. 2º Beta.');
  });
});
