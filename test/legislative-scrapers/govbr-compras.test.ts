// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GovBrComprasScraper } from '../../lib/legislative-scrapers/govbr-compras';

const FIXTURES = join(__dirname, 'fixtures');

function mockFetch(html: string) {
  global.fetch = async () =>
    new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
}

describe('GovBrComprasScraper — Portaria SEGES/MGI 4.932/2023 (caso truncation)', () => {
  const html = readFileSync(join(FIXTURES, 'govbr-portaria-seges-mgi-4932-2023.html'), 'utf-8');
  const url = 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-4-932-de-30-de-agosto-de-2023';

  it('extrai conteúdo substantivo (não o stub curto do #content-core pré-fix)', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape(url);

    expect(result.success).toBe(true);
    // Pré-fix: extractContent retornava ~826 chars (stub curto do #content-core
    // que envolvia apenas navegação/metadata). Pós-fix: seletor '#parent-fieldname-text'
    // é agora incluído na lista primária e, via estratégia "maior match",
    // retorna o corpo completo da portaria (~1600 chars para este ato curto de
    // 2 artigos; atos mais longos como as resoluções SEGES-CICS retornam >10k).
    expect(result.content!.length).toBeGreaterThan(1500);
  });

  it('contém o corpo da portaria (Art. 1º, Art. 2º, etc.)', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape(url);

    expect(result.content).toContain('Art. 1');
    expect(result.content).toContain('Art. 2');
    expect(result.content).toMatch(/PORTARIA SEGES\/MGI/);
  });
});

describe('GovBrComprasScraper — IN SGD/MGI 86/2025 (caso in.gov.br boilerplate)', () => {
  const html = readFileSync(join(FIXTURES, 'in-gov-br-sgd-mgi-86-2025.html'), 'utf-8');
  const url = 'https://www.in.gov.br/web/dou/-/instrucao-normativa-sgd/mgi-n-86-de-25-de-julho-de-2025-645137365';

  it('NÃO contém "Brasão do Brasil" (masthead removido)', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape(url);
    expect(result.content).not.toContain('Brasão do Brasil');
  });

  it('NÃO contém "Borda do rodapé" nem "Logo da Imprensa" (footer removido)', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape(url);
    expect(result.content).not.toContain('Borda do rodapé');
    expect(result.content).not.toContain('Logo da Imprensa');
  });

  it('preserva o texto normativo', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape(url);
    expect(result.content).toContain('Instrução Normativa');
    expect(result.content).toMatch(/Art\.\s*\d+/);
  });

  it('preserva "Este conteúdo não substitui" se presente no HTML original', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape(url);
    // Condicional: só asserta se o fixture contém o marker
    if (html.includes('Este conteúdo não substitui')) {
      expect(result.content).toContain('Este conteúdo não substitui');
    }
  });
});

describe('GovBrComprasScraper — Portaria SGD/MGI 6.680/2024 (caso form annex)', () => {
  const html = readFileSync(join(FIXTURES, 'sgd-mgi-portaria-6680-2024.html'), 'utf-8');
  const url = 'https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/legislacao/modelo-de-contracao-de-servicos-de-operacao-de-infraestrutura-e-de-atendimento-a-usuarios-de-tic/portaria-sgd-mgi-no-6-680-de-4-de-outubro-de-2024';

  it('NÃO contém "<NOME DO FISCAL TECNICO>" no conteúdo', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape(url);
    expect(result.content).not.toContain('<NOME DO FISCAL TECNICO>');
    expect(result.content).not.toContain('<NOME DO GESTOR>');
    expect(result.content).not.toContain('<NOME DO PREPOSTO>');
  });

  it('preserva texto normativo (Art. 1º e ementa)', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape(url);
    expect(result.content).toMatch(/Portaria SGD\/MGI/i);
    expect(result.content).toMatch(/Art\.\s*1/);
  });
});
