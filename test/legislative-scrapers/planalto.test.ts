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
