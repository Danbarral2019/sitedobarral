import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import * as cheerio from 'cheerio/slim';

/**
 * Os raspadores usam `cheerio/slim`, que analisa com o htmlparser2, o mesmo
 * parser da 0.22. O `cheerio` padrão da 1.x usa o parse5, que reescreve o HTML
 * mal formado das páginas do Planalto e do DOU e muda o texto extraído
 * (outra contagem de parágrafos no mesmo decreto).
 */
describe('parser do cheerio nos raspadores', () => {
  it('nenhum arquivo importa o cheerio padrão (parse5)', () => {
    const achados = execSync(
      `git grep -nE "from ['\\"]cheerio['\\"]" -- lib app scripts ':!scripts/.archived' || true`,
      { encoding: 'utf8' },
    ).trim();
    expect(achados).toBe('');
  });

  it('mantém a contagem de parágrafos do decreto do Planalto', () => {
    const html = readFileSync('test/legislative-scrapers/fixtures/planalto-decreto-12807-2025.html', 'utf8');
    expect(cheerio.load(html)('p').length).toBe(74);
  });
});
