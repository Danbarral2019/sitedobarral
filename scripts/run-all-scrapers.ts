/**
 * Script para rodar todos os scrapers de tribunais manualmente.
 * Uso: npx tsx scripts/run-all-scrapers.ts [--scraper tce-sc] [--max 50]
 */

import { getAllScrapers, getScraper } from '@/lib/tribunal-scrapers';

async function main() {
  const args = process.argv.slice(2);
  const scraperFilter = args.includes('--scraper') ? args[args.indexOf('--scraper') + 1] : null;
  const maxItems = args.includes('--max') ? parseInt(args[args.indexOf('--max') + 1], 10) : 50;
  const forceRescrape = args.includes('--force');

  console.log('=== Rodando scrapers de tribunais ===\n');

  const scrapers = scraperFilter
    ? [getScraper(scraperFilter)].filter(Boolean)
    : getAllScrapers();

  if (scrapers.length === 0) {
    console.error(`Scraper "${scraperFilter}" nao encontrado.`);
    process.exit(1);
  }

  console.log(`Scrapers a executar: ${scrapers.map(s => s!.code).join(', ')}`);
  console.log(`Max items por scraper: ${maxItems}${forceRescrape ? ' (forceRescrape)' : ''}\n`);

  const results: Array<{ code: string; found: number; new_: number; skipped: number; errors: number; duration: number; errorMsgs: string[] }> = [];

  for (const scraper of scrapers) {
    if (!scraper) continue;

    console.log(`--- ${scraper.code} (${scraper.fullName}) ---`);
    const startTime = Date.now();

    try {
      const result = await scraper.scrape({ maxItems, forceRescrape });
      const duration = Math.round((Date.now() - startTime) / 1000);

      console.log(`  Found: ${result.itemsFound} | New: ${result.itemsNew} | Skipped: ${result.itemsSkipped} | Errors: ${result.itemsError} | ${duration}s`);
      if (result.errors.length > 0) {
        console.log(`  Erros: ${result.errors.slice(0, 3).join('; ')}`);
      }

      results.push({
        code: scraper.code,
        found: result.itemsFound,
        new_: result.itemsNew,
        skipped: result.itemsSkipped,
        errors: result.itemsError,
        duration,
        errorMsgs: result.errors,
      });
    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  FALHOU: ${msg} (${duration}s)`);

      results.push({
        code: scraper.code,
        found: 0,
        new_: 0,
        skipped: 0,
        errors: 1,
        duration,
        errorMsgs: [msg],
      });
    }

    console.log('');
  }

  // Summary
  console.log('=== RESUMO ===');
  console.log('');
  console.log('Scraper        | Found | New  | Skip | Err | Tempo');
  console.log('---------------|-------|------|------|-----|------');
  for (const r of results) {
    const code = r.code.padEnd(14);
    const found = String(r.found).padStart(5);
    const new_ = String(r.new_).padStart(4);
    const skip = String(r.skipped).padStart(4);
    const err = String(r.errors).padStart(3);
    const time = `${r.duration}s`.padStart(5);
    console.log(`${code} |${found} |${new_} |${skip} |${err} |${time}`);
  }

  const totalNew = results.reduce((s, r) => s + r.new_, 0);
  const totalFound = results.reduce((s, r) => s + r.found, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors, 0);
  console.log(`\nTotal: ${totalFound} encontrados, ${totalNew} novos, ${totalErrors} erros`);

  process.exit(0);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
