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
