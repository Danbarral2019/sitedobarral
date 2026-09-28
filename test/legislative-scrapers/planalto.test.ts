// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PlanaltoScraper } from '../../lib/legislative-scrapers/planalto';

const FIXTURE_PATH = join(__dirname, 'fixtures/planalto-decreto-12807-2025.html');
const FIXTURE_HTML = readFileSync(FIXTURE_PATH, 'utf-8');

function mockFetch(html: string) {
  global.fetch = async () =>
    new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
}

describe('PlanaltoScraper — Decreto 12.807/2025 (via fixture)', () => {
  it('extrai conteúdo substantivo (>2000 chars)', async () => {
    mockFetch(FIXTURE_HTML);
    const scraper = new PlanaltoScraper();
    const result = await scraper.scrape('https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/D12807.htm');

    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content!.length).toBeGreaterThan(2000);
  });

  it('contém o texto normativo principal', async () => {
    mockFetch(FIXTURE_HTML);
    const scraper = new PlanaltoScraper();
    const result = await scraper.scrape('https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/D12807.htm');

    expect(result.content).toContain('DECRETO');
    expect(result.content).toContain('Art.');
  });

  it('NÃO contém runs de 3+ linhas em branco consecutivas', async () => {
    mockFetch(FIXTURE_HTML);
    const scraper = new PlanaltoScraper();
    const result = await scraper.scrape('https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/D12807.htm');

    expect(result.content).not.toMatch(/\n{3,}/);
    expect(result.content).not.toMatch(/(\s*\n){3,}/);
  });

  it('NÃO contém NBSP isolado em linhas vazias', async () => {
    mockFetch(FIXTURE_HTML);
    const scraper = new PlanaltoScraper();
    const result = await scraper.scrape('https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/D12807.htm');

    expect(result.content).not.toMatch(/^[\u00A0]+$/m);
  });
});

// REGRESSION: Decreto 12.516/2025 (reportado pelo user 2026-04-25) tinha
// "Art. 2º .........................................." (pontilhados longos
// pra omitir trechos não alterados). Padrão internacional é "[...]".
describe('PlanaltoScraper — pontilhados (regression Decreto 12.516/2025)', () => {
  it('normaliza pontilhados longos pra "[...]"', async () => {
    const synthetic = `<html><body><div id="conteudoTexto">
      <p>O Vice-presidente da Republica, no exercicio do cargo de Presidente, no uso das atribuicoes que lhe confere o art. 84, caput, incisos IV e VI da Constituicao, e tendo em vista o disposto no art. 25 da Lei 14.133/2021, decreta:</p>
      <p>Art. 1o O Decreto no 11.430/2023 passa a vigorar com as seguintes alteracoes:</p>
      <p>Art. 2o ..........................................................................</p>
      <p>I - acordo de adesao - instrumento por meio do qual e formalizada cooperacao entre a administracao publica federal e a unidade responsavel pela politica publica, para o desenvolvimento de acoes de interesse publico e reciproco sem transferencia de recursos financeiros;</p>
      <p>...........................................................................................</p>
      <p>(NR)</p>
      <p>Art. 3o Este Decreto entra em vigor na data de sua publicacao.</p>
    </div></body></html>`;
    mockFetch(synthetic);
    const scraper = new PlanaltoScraper();
    const result = await scraper.scrape('https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/D12516.htm');

    expect(result.success).toBe(true);
    expect(result.content).toContain('[...]');
    expect(result.content).not.toMatch(/\.{10,}/);
    expect(result.content).toContain('acordo de adesao');
    expect(result.content).toContain('(NR)');
  });

  it('preserva "..." de 3 pontos em fim de frase (threshold 6+)', () => {
    const scraper = new PlanaltoScraper();
    const cleanText = (scraper as any).cleanText.bind(scraper);
    const out = cleanText('Art. 1o Esta lei dispoe sobre licitacoes etc...');
    expect(out).toContain('etc...');
    expect(out).not.toContain('etc [...]');
  });
});

describe('PlanaltoScraper: seletor que pega só uma tabela lateral (regression Código Civil compilado)', () => {
  it('usa o corpo da página quando o bloco do seletor é menos da metade dele', async () => {
    const artigos = Array.from(
      { length: 40 },
      (_, i) => `<p>Art. ${i + 1}. Texto do artigo ${i + 1} do código, com redação suficiente para compor o corpo da lei.</p>`,
    ).join('\n');
    const synthetic = `<html><body>
      <table><tr><td>Presidência da República</td></tr></table>
      <table><tr><td>Vigência. Mensagem de veto. Texto compilado. Vide Lei nº 10.825, de 2003. Vide Lei nº 11.127, de 2005. Vide Lei nº 14.195, de 2021. Produção de efeitos.</td></tr></table>
      <p>LEI Nº 10.406, DE 10 DE JANEIRO DE 2002</p>
      <p>Institui o Código Civil.</p>
      ${artigos}
    </body></html>`;
    mockFetch(synthetic);
    const scraper = new PlanaltoScraper();
    const result = await scraper.scrape('https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm');

    expect(result.success).toBe(true);
    expect(result.content).toContain('Institui o Código Civil.');
    expect(result.content).toContain('Art. 40.');
  });
});

describe('PlanaltoScraper: HTML malformado do Planalto (regression Código Civil e Lei 10.973/2004)', () => {
  const artigos = Array.from(
    { length: 30 },
    (_, i) => `<p>Art. ${i + 1}. Texto do artigo ${i + 1}, com redação suficiente para compor o corpo da lei.</p>`,
  ).join('\n');

  it('lê o texto que vem depois de um </body> prematuro', async () => {
    mockFetch(`<html><head><title>L10406compilada</title><style><!-- x {} --></style></head>
      <body><div><center><table><tr><td><p>Presidência da República</p></td></tr></table></center></div>
      <p>LEI Nº 10.406, DE 10 DE JANEIRO DE 2002</p></body></html>
      <p>Institui o Código Civil.</p>${artigos}`);
    const result = await new PlanaltoScraper().scrape('https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm');

    expect(result.success).toBe(true);
    expect(result.content).toContain('Institui o Código Civil.');
    expect(result.content).toContain('Art. 30.');
    expect(result.content).not.toContain('L10406compilada');
  });

  it('lê página sem <html>, <head> nem <body>', async () => {
    mockFetch(`    <title>L10973</title>
      <div align="center"><center><table><tr><td><p>Presidência da República</p></td></tr></table></center></div>
      <p>LEI Nº 10.973, DE 2 DE DEZEMBRO DE 2004</p>${artigos}`);
    const result = await new PlanaltoScraper().scrape('https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l10.973.htm');

    expect(result.success).toBe(true);
    expect(result.content).toContain('LEI Nº 10.973');
    expect(result.content).toContain('Art. 30.');
    expect(result.content).not.toContain('L10973\n');
  });
});
