/**
 * Script para corrigir encoding de atos normativos com caracteres mojibake
 *
 * Identifica atos cujo content contém caracteres de encoding incorreto
 * e re-faz o scraping usando ISO-8859-1 para páginas gov.br
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/fix-encoding-content.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/fix-encoding-content.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/fix-encoding-content.ts --limit 5
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit'));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1] || process.argv[process.argv.indexOf('--limit') + 1] || '0') : 0;
const DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function md5(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

// Check if content has mojibake characters
function hasMojibake(text: string): boolean {
  // U+FFFD replacement character
  if (text.includes('\uFFFD')) return true;
  // Common ISO-8859-1 → UTF-8 mojibake patterns
  // Characters like ã, é, ç become garbled
  if (/[\u00C3][\u00A0-\u00BF]/.test(text)) return true; // Double-encoded UTF-8
  if (/\u00EF\u00BF\u00BD/.test(text)) return true; // Encoded replacement char
  return false;
}

// Same HTML strip/extract functions from scrape-legislative-acts-content.ts
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<(p|div|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
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
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractPlanalto(html: string): string {
  const textoMatch = html.match(/<div[^>]*id=["']?texto["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (textoMatch) return stripHtml(textoMatch[1]);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return stripHtml(bodyMatch[1]);
  return stripHtml(html);
}

function extractGovBr(html: string): string {
  const contentCore = html.match(/<div[^>]*id=["']?content-core["']?[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
  if (contentCore) return stripHtml(contentCore[1]);
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return stripHtml(articleMatch[1]);
  const textField = html.match(/<div[^>]*id=["']?parent-fieldname-text["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (textField) return stripHtml(textField[1]);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return stripHtml(bodyMatch[1]);
  return stripHtml(html);
}

function extractContent(html: string, url: string): string {
  if (url.includes('planalto.gov.br')) return extractPlanalto(html);
  if (url.includes('gov.br')) return extractGovBr(html);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return stripHtml(bodyMatch ? bodyMatch[1] : html);
}

async function fetchWithEncoding(url: string, retries = 3): Promise<string | null> {
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
        if (response.status === 429 || response.status >= 500) {
          await sleep(5000 * (i + 1));
          continue;
        }
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      const charset = contentType.match(/charset=([^\s;]+)/i)?.[1]?.toLowerCase();
      const isLatin1 = charset === 'iso-8859-1' || charset === 'latin1' || charset === 'latin-1';
      const isGovBrSite = url.includes('planalto.gov.br') || url.includes('.gov.br');

      // Use ISO-8859-1 decoder for Latin-1 encoded pages
      if (isLatin1 || (!charset && isGovBrSite)) {
        const buffer = await response.arrayBuffer();
        return new TextDecoder('iso-8859-1').decode(buffer);
      }

      return await response.text();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.log(`    Tentativa ${i + 1}/${retries} falhou: ${errMsg}`);
      if (i < retries - 1) await sleep(3000 * (i + 1));
    }
  }
  return null;
}

async function main() {
  console.log('=== Correção de Encoding dos Atos Normativos ===');
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN' : 'PRODUÇÃO'}`);
  if (LIMIT) console.log(`Limite: ${LIMIT}`);
  console.log('');

  // Find all acts with content
  const allActs = await prisma.legislativeAct.findMany({
    where: {
      content: { not: null },
      officialUrl: { not: null },
    },
    select: {
      id: true,
      fullNumber: true,
      content: true,
      officialUrl: true,
    },
  });

  // Filter those with mojibake
  const brokenActs = allActs.filter(act => act.content && hasMojibake(act.content));

  console.log(`Total atos com content: ${allActs.length}`);
  console.log(`Atos com encoding incorreto: ${brokenActs.length}`);
  console.log('');

  let toProcess = brokenActs;
  if (LIMIT > 0) toProcess = toProcess.slice(0, LIMIT);

  if (toProcess.length === 0) {
    console.log('Nenhum ato com encoding incorreto encontrado.');
    await prisma.$disconnect();
    return;
  }

  let success = 0;
  let failed = 0;

  for (const act of toProcess) {
    console.log(`  ${act.fullNumber}:`);
    console.log(`    URL: ${act.officialUrl}`);

    if (DRY_RUN) {
      // Show sample of broken content
      const sample = (act.content || '').substring(0, 100);
      console.log(`    [DRY RUN] Content sample: ${sample}`);
      success++;
      continue;
    }

    const html = await fetchWithEncoding(act.officialUrl!);
    if (!html) {
      console.log(`    FALHA: não foi possível baixar o HTML`);
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    const content = extractContent(html, act.officialUrl!);

    if (content.length < 100) {
      console.log(`    FALHA: conteúdo muito curto (${content.length} chars)`);
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    if (hasMojibake(content)) {
      console.log(`    FALHA: conteúdo ainda tem mojibake após re-scraping`);
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    const hash = md5(content);
    await prisma.legislativeAct.update({
      where: { id: act.id },
      data: {
        content,
        contentHash: hash,
        scrapeStatus: 'success',
        lastScrapedAt: new Date(),
      },
    });

    console.log(`    OK: ${content.length} chars (encoding corrigido)`);
    success++;
    await sleep(DELAY_MS);
  }

  console.log('');
  console.log('=== Resultado ===');
  console.log(`Corrigidos: ${success}`);
  console.log(`Falha: ${failed}`);
  console.log(`Total: ${toProcess.length}`);

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
