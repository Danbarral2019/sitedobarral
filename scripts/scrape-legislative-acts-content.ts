/**
 * Script para fazer scraping do inteiro teor dos atos normativos
 *
 * Para cada LegislativeAct com officialUrl e sem content:
 * 1. Faz fetch do HTML da URL oficial
 * 2. Extrai texto limpo do corpo do ato (parser por domínio)
 * 3. Salva no campo `content` do LegislativeAct
 * 4. Atualiza contentHash e scrapeStatus
 *
 * Após rodar, executar:
 *   npx dotenv -e .env.local -- npx tsx scripts/index-legislative-acts.ts --force
 *   npx dotenv -e .env.local -- npx tsx scripts/migrate-to-embeddings.ts
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/scrape-legislative-acts-content.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/scrape-legislative-acts-content.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/scrape-legislative-acts-content.ts --force
 *   npx dotenv -e .env.local -- npx tsx scripts/scrape-legislative-acts-content.ts --limit 5
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit'));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1] || process.argv[process.argv.indexOf('--limit') + 1] || '0') : 0;

// Delay entre requests para não sobrecarregar os servidores
const DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function md5(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * Remove tags HTML e normaliza whitespace
 */
function stripHtml(html: string): string {
  return html
    // Remove scripts e styles
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Converte <br>, <p>, <div>, <li> em quebras de linha
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<(p|div|li|h[1-6])[^>]*>/gi, '\n')
    // Remove todas as outras tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    // Normaliza whitespace
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extrai conteúdo de páginas do Planalto (decretos)
 * Padrão: www.planalto.gov.br/ccivil_03/_ato...
 */
function extractPlanalto(html: string): string {
  // O texto legal fica dentro de <div id="texto"> ou <body>
  // Tentar extrair <div id="texto">...</div> primeiro
  const textoMatch = html.match(/<div[^>]*id=["']?texto["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (textoMatch) {
    return stripHtml(textoMatch[1]);
  }

  // Fallback: extrair todo o <body>
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return stripHtml(bodyMatch[1]);
  }

  return stripHtml(html);
}

/**
 * Extrai conteúdo de páginas gov.br (INs, Portarias)
 * Padrão: www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/...
 */
function extractGovBr(html: string): string {
  // Tentativa 1: conteúdo principal em <div id="content-core">
  const contentCore = html.match(/<div[^>]*id=["']?content-core["']?[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
  if (contentCore) {
    return stripHtml(contentCore[1]);
  }

  // Tentativa 2: <article> ou <div class="page-content">
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    return stripHtml(articleMatch[1]);
  }

  // Tentativa 3: <div id="parent-fieldname-text">
  const textField = html.match(/<div[^>]*id=["']?parent-fieldname-text["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (textField) {
    return stripHtml(textField[1]);
  }

  // Tentativa 4: div com classe específica do portal
  const portalContent = html.match(/<div[^>]*class=["'][^"']*documentDescription[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (portalContent) {
    return stripHtml(portalContent[1]);
  }

  // Fallback: body inteiro
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return stripHtml(bodyMatch[1]);
  }

  return stripHtml(html);
}

/**
 * Determina o parser baseado no domínio da URL
 */
function extractContent(html: string, url: string): string {
  if (url.includes('planalto.gov.br')) {
    return extractPlanalto(html);
  }
  if (url.includes('gov.br')) {
    return extractGovBr(html);
  }
  // Fallback genérico
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return stripHtml(bodyMatch ? bodyMatch[1] : html);
}

/**
 * Faz fetch com retry e timeout
 */
async function fetchWithRetry(url: string, retries = 3): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SiteDoBarral/1.0; +https://sitedobarral.com.br)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.log(`    HTTP ${response.status} para ${url}`);
        if (response.status === 429 || response.status >= 500) {
          await sleep(5000 * (i + 1)); // Backoff
          continue;
        }
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml')) {
        console.log(`    Content-Type não suportado: ${contentType}`);
        return null;
      }

      return await response.text();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.log(`    Tentativa ${i + 1}/${retries} falhou: ${errMsg}`);
      if (i < retries - 1) {
        await sleep(3000 * (i + 1));
      }
    }
  }
  return null;
}

async function main() {
  console.log('=== Scraping do Inteiro Teor dos Atos Normativos ===');
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN (sem alterações)' : 'PRODUÇÃO'}`);
  console.log(`Force: ${FORCE ? 'Sim (reprocessar todos)' : 'Não (apenas sem content)'}`);
  if (LIMIT) console.log(`Limite: ${LIMIT} atos`);
  console.log('');

  // Buscar atos que precisam de scraping
  const whereClause = FORCE
    ? { officialUrl: { not: null } }
    : { officialUrl: { not: null }, content: null };

  let acts = await prisma.legislativeAct.findMany({
    where: whereClause as Record<string, unknown>,
    orderBy: { publishDate: 'desc' },
    select: {
      id: true,
      fullNumber: true,
      officialUrl: true,
      content: true,
      contentHash: true,
      scrapeStatus: true,
    },
  });

  if (LIMIT > 0) {
    acts = acts.slice(0, LIMIT);
  }

  console.log(`Encontrados: ${acts.length} atos para processar\n`);

  let success = 0;
  let failed = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const act of acts) {
    const url = act.officialUrl!;
    console.log(`  ${act.fullNumber}:`);
    console.log(`    URL: ${url}`);

    if (DRY_RUN) {
      console.log(`    [DRY RUN] Faria scraping`);
      success++;
      await sleep(100);
      continue;
    }

    // Fetch HTML
    const html = await fetchWithRetry(url);
    if (!html) {
      console.log(`    FALHA: não foi possível baixar o HTML`);
      await prisma.legislativeAct.update({
        where: { id: act.id },
        data: {
          scrapeStatus: 'failed',
          lastScrapedAt: new Date(),
        },
      });
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    // Extrair conteúdo
    const content = extractContent(html, url);

    if (content.length < 100) {
      console.log(`    FALHA: conteúdo extraído muito curto (${content.length} chars)`);
      await prisma.legislativeAct.update({
        where: { id: act.id },
        data: {
          scrapeStatus: 'failed',
          lastScrapedAt: new Date(),
        },
      });
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    // Check hash para detectar mudanças
    const hash = md5(content);
    if (act.contentHash === hash && !FORCE) {
      console.log(`    INALTERADO (hash: ${hash.substring(0, 8)}...)`);
      await prisma.legislativeAct.update({
        where: { id: act.id },
        data: {
          scrapeStatus: 'unchanged',
          lastScrapedAt: new Date(),
        },
      });
      unchanged++;
      await sleep(DELAY_MS);
      continue;
    }

    // Salvar conteúdo
    await prisma.legislativeAct.update({
      where: { id: act.id },
      data: {
        content,
        contentHash: hash,
        scrapeStatus: 'success',
        lastScrapedAt: new Date(),
      },
    });

    console.log(`    OK: ${content.length} chars (hash: ${hash.substring(0, 8)}...)`);
    success++;

    await sleep(DELAY_MS);
  }

  console.log('');
  console.log('=== Resultado ===');
  console.log(`Sucesso: ${success}`);
  console.log(`Falha: ${failed}`);
  console.log(`Inalterado: ${unchanged}`);
  console.log(`Pulado: ${skipped}`);
  console.log(`Total: ${acts.length}`);

  if (!DRY_RUN && success > 0) {
    console.log('');
    console.log('Próximos passos:');
    console.log('  1. npx dotenv -e .env.local -- npx tsx scripts/index-legislative-acts.ts --force');
    console.log('  2. npx dotenv -e .env.local -- npx tsx scripts/migrate-to-embeddings.ts');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  prisma.$disconnect();
  process.exit(1);
});
