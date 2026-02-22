// @ts-nocheck
/**
 * Diagnostico de Scrapers de Tribunais
 *
 * Testa a conectividade e analisa a estrutura HTML real de cada site de TCE.
 * Identifica os seletores CSS corretos para parsing.
 *
 * Uso:
 *   npx tsx scripts/test-tribunal-scrapers.ts
 *   npx tsx scripts/test-tribunal-scrapers.ts --scraper tce-sp
 *   npx tsx scripts/test-tribunal-scrapers.ts --save-html
 *   npx tsx scripts/test-tribunal-scrapers.ts --test-search "licitação"
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ===========================
// Configuration
// ===========================

interface ScraperTestConfig {
  code: string;
  name: string;
  urls: {
    home: string;
    search: (term: string) => string;
    detail?: string;
  };
  description: string;
}

const SCRAPERS: ScraperTestConfig[] = [
  {
    code: 'tce-sp',
    name: 'TCE-SP',
    urls: {
      home: 'https://www4.tce.sp.gov.br/pesquisa-de-jurisprudencia',
      search: (term: string) =>
        `https://www4.tce.sp.gov.br/resultado-da-pesquisa-jurisprudencia?keys=${encodeURIComponent(term)}`,
      detail: 'https://www4.tce.sp.gov.br/sumulas',
    },
    description: 'Tribunal de Contas do Estado de Sao Paulo (www4.tce.sp.gov.br)',
  },
  {
    code: 'tce-mg',
    name: 'TCE-MG',
    urls: {
      home: 'https://tcjuris.tce.mg.gov.br/',
      search: (term: string) =>
        `https://tcjuris.tce.mg.gov.br/Home/Index?texto=${encodeURIComponent(term)}`,
    },
    description: 'Tribunal de Contas do Estado de Minas Gerais (tcjuris.tce.mg.gov.br)',
  },
  {
    code: 'tce-pr',
    name: 'TCE-PR',
    urls: {
      home: 'https://viajuris.tce.pr.gov.br/',
      search: (term: string) =>
        `https://viajuris.tce.pr.gov.br/Pesquisa/Buscar?texto=${encodeURIComponent(term)}`,
      detail: 'https://www1.tce.pr.gov.br/conteudo/lista/acordaos/1413',
    },
    description: 'Tribunal de Contas do Estado do Parana (viajuris.tce.pr.gov.br)',
  },
];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ===========================
// Utility Functions
// ===========================

async function fetchWithTimeout(url: string, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function analyzeHtmlStructure(html: string, url: string): void {
  const $ = cheerio.load(html);

  console.log(`\n  📄 Tamanho do HTML: ${html.length} chars`);
  console.log(`  📄 Title: ${$('title').text().trim()}`);

  // Check for common frameworks
  const frameworks: string[] = [];
  if ($('meta[name="generator"]').length) frameworks.push($('meta[name="generator"]').attr('content') || 'unknown');
  if (html.includes('angular')) frameworks.push('Angular');
  if (html.includes('react')) frameworks.push('React');
  if (html.includes('vue')) frameworks.push('Vue');
  if (html.includes('__VIEWSTATE')) frameworks.push('ASP.NET WebForms');
  if (html.includes('__RequestVerificationToken')) frameworks.push('ASP.NET MVC');
  if (html.includes('drupal')) frameworks.push('Drupal');
  if (html.includes('wordpress') || html.includes('wp-content')) frameworks.push('WordPress');
  if (frameworks.length) console.log(`  🔧 Framework detectado: ${frameworks.join(', ')}`);

  // Find forms
  const forms = $('form');
  if (forms.length > 0) {
    console.log(`\n  📝 Formularios encontrados: ${forms.length}`);
    forms.each((i, el) => {
      const $form = $(el);
      const action = $form.attr('action') || '(sem action)';
      const method = $form.attr('method') || 'GET';
      const id = $form.attr('id') || $form.attr('name') || '(sem id)';
      console.log(`     Form #${i + 1}: ${method.toUpperCase()} ${action} [id=${id}]`);

      // Input fields
      $form.find('input, select, textarea').each((_, inp) => {
        const $inp = $(inp);
        const type = $inp.attr('type') || $inp.prop('tagName')?.toLowerCase() || 'text';
        const name = $inp.attr('name') || '(sem name)';
        const placeholder = $inp.attr('placeholder') || '';
        console.log(`       - ${type}: name="${name}" ${placeholder ? `placeholder="${placeholder}"` : ''}`);
      });
    });
  }

  // Analyze content structure
  console.log('\n  🏗️ Estrutura de conteudo:');

  // Look for result containers
  const interestingSelectors = [
    // Generic result patterns
    '.resultado', '.resultados', '.result', '.results', '.search-results',
    '.list-group', '.card', '.panel',
    // Table patterns
    'table', 'table.tabela', 'table.table',
    // Jurisprudence-specific
    '.jurisprudencia', '.acordao', '.decisao', '.ementa',
    '.item-resultado', '.resultado-item', '.search-result',
    // Content areas
    '#conteudo', '#content', '.conteudo', '.content',
    '#resultados', '.resultado-pesquisa',
    // TCJuris specific
    '.panel-default', '.panel-body', '.well',
    // ViaJuris specific
    '.pesquisa-resultado', '.lista-resultados',
  ];

  const found: string[] = [];
  for (const sel of interestingSelectors) {
    const count = $(sel).length;
    if (count > 0) {
      found.push(`${sel} (${count})`);
    }
  }

  if (found.length > 0) {
    console.log(`     Seletores com resultados:`);
    found.forEach(f => console.log(`       ✅ ${f}`));
  } else {
    console.log('     ⚠️ Nenhum seletor padrao encontrado');
  }

  // Find links with jurisprudence-related hrefs
  const jurisLinks: string[] = [];
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.match(/acordao|decisao|jurisprud|processo|parecer|sumula|viajuris|Pesquisa/i)) {
      const text = $(el).text().trim().slice(0, 80);
      if (text.length > 5) {
        jurisLinks.push(`"${text}" → ${href}`);
      }
    }
  });

  if (jurisLinks.length > 0) {
    console.log(`\n  🔗 Links relevantes (${Math.min(jurisLinks.length, 15)} de ${jurisLinks.length}):`);
    jurisLinks.slice(0, 15).forEach(l => console.log(`       ${l}`));
  }

  // Dump main content area
  const mainContent = $('#conteudo, #content, .conteudo, .content, main, [role="main"], .region-content').first();
  if (mainContent.length) {
    const classes = collectClasses($, mainContent);
    console.log(`\n  📦 Area de conteudo principal: ${mainContent.prop('tagName')} #${mainContent.attr('id') || '?'} .${mainContent.attr('class') || '?'}`);
    console.log(`     Classes encontradas no conteudo: ${classes.slice(0, 20).join(', ')}`);
  }

  // Check for pagination
  const pagination = $('nav.pagination, .pagination, .pager, .paginacao, [class*="paginat"], [class*="pagina"]');
  if (pagination.length) {
    console.log(`\n  📄 Paginacao encontrada: ${pagination.attr('class')}`);
  }

  // Check for AJAX/API patterns
  const scripts = $('script');
  const apiPatterns: string[] = [];
  scripts.each((_, el) => {
    const text = $(el).html() || '';
    const matches = text.match(/(?:fetch|axios|ajax|XMLHttpRequest|\.get|\.post)\s*\(\s*['"`]([^'"`]+)/g);
    if (matches) {
      apiPatterns.push(...matches.map(m => m.slice(0, 100)));
    }
    // Look for API URLs
    const urlMatches = text.match(/['"`](\/api\/[^'"`]+|https?:\/\/[^'"`]*api[^'"`]*)/g);
    if (urlMatches) {
      apiPatterns.push(...urlMatches.map(m => m.slice(1, -1).slice(0, 100)));
    }
  });

  if (apiPatterns.length > 0) {
    console.log(`\n  🌐 Padroes de API encontrados (${apiPatterns.length}):`);
    [...new Set(apiPatterns)].slice(0, 10).forEach(p => console.log(`       ${p}`));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectClasses($: any, container: any): string[] {
  const classes = new Set<string>();
  container.find('*').each((_: number, el: unknown) => {
    const cls = $(el).attr('class');
    if (cls) {
      cls.split(/\s+/).forEach(c => {
        if (c.length > 2 && !c.startsWith('col-') && !c.startsWith('row')) {
          classes.add(c);
        }
      });
    }
  });
  return [...classes].sort();
}

// ===========================
// Test Functions
// ===========================

async function testScraper(config: ScraperTestConfig, options: TestOptions): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🏛️  ${config.name} — ${config.description}`);
  console.log('='.repeat(60));

  // 1. Test home page connectivity
  console.log(`\n1️⃣  Testando conectividade: ${config.urls.home}`);
  try {
    const response = await fetchWithTimeout(config.urls.home);
    console.log(`  ✅ HTTP ${response.status} ${response.statusText}`);
    console.log(`  📍 URL final: ${response.url}`);
    console.log(`  📏 Content-Length: ${response.headers.get('content-length') || 'N/A'}`);
    console.log(`  📦 Content-Type: ${response.headers.get('content-type') || 'N/A'}`);

    const html = await response.text();

    if (options.saveHtml) {
      const filename = `/tmp/tce-${config.code}-home.html`;
      fs.writeFileSync(filename, html);
      console.log(`  💾 HTML salvo em: ${filename}`);
    }

    analyzeHtmlStructure(html, config.urls.home);
  } catch (error) {
    console.log(`  ❌ Falha: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  // 2. Test search
  const searchTerm = options.searchTerm || 'licitação';
  console.log(`\n2️⃣  Testando busca por "${searchTerm}": ${config.urls.search(searchTerm)}`);

  try {
    await new Promise(r => setTimeout(r, 2000)); // Rate limit

    const response = await fetchWithTimeout(config.urls.search(searchTerm));
    console.log(`  ✅ HTTP ${response.status} ${response.statusText}`);
    console.log(`  📍 URL final: ${response.url}`);

    const html = await response.text();

    if (options.saveHtml) {
      const filename = `/tmp/tce-${config.code}-search.html`;
      fs.writeFileSync(filename, html);
      console.log(`  💾 HTML salvo em: ${filename}`);
    }

    analyzeHtmlStructure(html, config.urls.search(searchTerm));

    // Try to extract decisions
    console.log('\n  🔍 Tentando extrair decisoes do HTML...');
    const $ = cheerio.load(html);

    // Count potential result items
    let found = false;

    // Try various extraction strategies
    const strategies = [
      { name: 'Links com "acordao/decisao"', selector: 'a[href*="cordao"], a[href*="ecisao"], a[href*="Detalhes"]' },
      { name: 'Tabela com resultados', selector: 'table tbody tr' },
      { name: 'Divs com classe resultado', selector: '[class*="result"], [class*="item"]' },
      { name: 'Paragrafos com ementa', selector: 'p:contains("EMENTA"), p:contains("ACORDAM"), div:contains("EMENTA")' },
      { name: 'Cards/panels', selector: '.card, .panel, .well, .card-body' },
      { name: 'Lista de items', selector: 'ul li, ol li, dl dt' },
    ];

    for (const strategy of strategies) {
      const items = $(strategy.selector);
      if (items.length > 0) {
        found = true;
        console.log(`  ✅ "${strategy.name}": ${items.length} elementos`);

        // Show first 3 items sample
        items.slice(0, 3).each((i, el) => {
          const text = $(el).text().trim().replace(/\s+/g, ' ').slice(0, 150);
          const href = $(el).is('a') ? $(el).attr('href') : $(el).find('a').first().attr('href');
          console.log(`     [${i + 1}] ${text}`);
          if (href) console.log(`         → ${href}`);
        });
      }
    }

    if (!found) {
      console.log('  ⚠️ Nenhuma estrategia de extracao funcionou');
      console.log('  💡 O site pode usar renderizacao client-side (SPA/AJAX)');

      // Check if it's a SPA
      if (html.includes('ng-app') || html.includes('data-ng-') || html.includes('__NEXT_DATA__')) {
        console.log('  ⚠️ Site parece ser uma SPA (Single Page App) - scraping HTML puro pode nao funcionar');
      }
    }
  } catch (error) {
    console.log(`  ❌ Falha: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 3. Test detail page if available
  if (config.urls.detail) {
    console.log(`\n3️⃣  Testando pagina de detalhes: ${config.urls.detail}`);
    try {
      await new Promise(r => setTimeout(r, 2000));

      const response = await fetchWithTimeout(config.urls.detail);
      console.log(`  ✅ HTTP ${response.status} ${response.statusText}`);

      const html = await response.text();
      if (options.saveHtml) {
        const filename = `/tmp/tce-${config.code}-detail.html`;
        fs.writeFileSync(filename, html);
        console.log(`  💾 HTML salvo em: ${filename}`);
      }

      analyzeHtmlStructure(html, config.urls.detail);
    } catch (error) {
      console.log(`  ❌ Falha: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// ===========================
// Main
// ===========================

interface TestOptions {
  scraperCode?: string;
  saveHtml: boolean;
  searchTerm?: string;
}

function parseArgs(): TestOptions {
  const args = process.argv.slice(2);
  const options: TestOptions = { saveHtml: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scraper' && args[i + 1]) {
      options.scraperCode = args[i + 1];
      i++;
    } else if (args[i] === '--save-html') {
      options.saveHtml = true;
    } else if (args[i] === '--test-search' && args[i + 1]) {
      options.searchTerm = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Diagnostico de Scrapers de Tribunais

Uso:
  npx tsx scripts/test-tribunal-scrapers.ts [opcoes]

Opcoes:
  --scraper CODE     Testar apenas um scraper (tce-sp, tce-mg, tce-pr)
  --save-html        Salvar HTML das paginas em /tmp/
  --test-search TERM Buscar por um termo especifico (padrao: "licitação")
  --help             Mostra esta mensagem
      `);
      process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     Diagnostico de Scrapers de Tribunais de Contas     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Data: ${new Date().toLocaleString('pt-BR')}`);

  const scrapers = options.scraperCode
    ? SCRAPERS.filter(s => s.code === options.scraperCode)
    : SCRAPERS;

  if (scrapers.length === 0) {
    console.error(`❌ Scraper "${options.scraperCode}" nao encontrado.`);
    console.error(`Scrapers disponíveis: ${SCRAPERS.map(s => s.code).join(', ')}`);
    process.exit(1);
  }

  for (const config of scrapers) {
    await testScraper(config, options);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Diagnostico concluido!');

  if (options.saveHtml) {
    console.log('\n📁 Arquivos HTML salvos em /tmp/:');
    const files = fs.readdirSync('/tmp').filter(f => f.startsWith('tce-'));
    files.forEach(f => console.log(`   ${f} (${(fs.statSync(path.join('/tmp', f)).size / 1024).toFixed(1)} KB)`));
  }

  console.log('\n💡 Proximos passos:');
  console.log('   1. Analise os seletores encontrados acima');
  console.log('   2. Se --save-html foi usado, abra os HTMLs no navegador');
  console.log('   3. Ajuste os seletores em lib/tribunal-scrapers/tce-*.ts');
  console.log('   4. Re-execute este script para confirmar');
}

main().catch(console.error);
