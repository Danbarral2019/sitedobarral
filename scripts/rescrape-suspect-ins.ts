/**
 * Re-scrape das INs com content curto (errors do validador).
 * Modo dry-run: só mostra o que viria da nova scrape sem alterar o DB.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/rescrape-suspect-ins.ts          # dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/rescrape-suspect-ins.ts --apply  # grava
 */
import { prisma } from '../lib/prisma';
import { GovBrComprasScraper } from '../lib/legislative-scrapers/govbr-compras';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { processLegislativeAct } from '../lib/embeddings/legislative-act-processor';

const SUSPECT_IDS = [
  // INs com content < 500 chars do audit
  'IN SEGES/MGI 381/2025',
  'IN SEGES 8/2023',
  'IN SEGES 90/2022',
  'IN SEGES/ME 5/2022',
  'IN SEGES 20/2022',
];

async function main() {
  const apply = process.argv.includes('--apply');
  const scraper = new GovBrComprasScraper();

  for (const fullNumber of SUSPECT_IDS) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📋 ${fullNumber}`);
    console.log('='.repeat(70));

    const act = await prisma.legislativeAct.findUnique({ where: { fullNumber } });
    if (!act) {
      console.log('❌ NÃO ENCONTRADO no banco');
      continue;
    }
    console.log(`   url:    ${act.officialUrl}`);
    console.log(`   chars:  ${act.content?.length ?? 0}`);
    console.log(`   início: "${act.content?.slice(0, 200)?.replace(/\n/g, ' ')}..."`);

    if (!act.officialUrl) {
      console.log('⚠️  Sem officialUrl — skip');
      continue;
    }

    console.log(`\n🌐 Re-scrapando...`);
    const result = await scraper.scrape(act.officialUrl);
    if (!result.success) {
      console.log(`❌ Scrape falhou: ${result.error}`);
      continue;
    }
    console.log(`   ✅ ${result.content?.length ?? 0} chars extraídos`);
    console.log(`   início: "${result.content?.slice(0, 200)?.replace(/\n/g, ' ')}..."`);

    const validation = validateActContent({ url: act.officialUrl, content: result.content });
    if (validation.errors.length) {
      console.log(`   🚫 Validação falhou:`);
      for (const e of validation.errors) console.log(`     - ${e}`);
    }
    if (validation.warnings.length) {
      console.log(`   ⚠️  Warnings:`);
      for (const w of validation.warnings) console.log(`     - ${w}`);
    }

    if (!apply) {
      console.log(`   🔒 dry-run — não escreveu no banco. Use --apply.`);
      continue;
    }

    if (validation.errors.length) {
      console.log(`   ⏭️  Pulando — não passou validação`);
      continue;
    }

    if ((result.content?.length ?? 0) <= (act.content?.length ?? 0)) {
      console.log(`   ⏭️  Pulando — novo content não é maior que o atual`);
      continue;
    }

    console.log(`   💾 Atualizando DB...`);
    await prisma.legislativeAct.update({
      where: { id: act.id },
      data: {
        content: result.content,
        contentHash: result.contentHash,
        embeddingStatus: 'pending',
      },
    });
    const deleted = await prisma.legislativeActChunk.deleteMany({ where: { legislativeActId: act.id } });
    console.log(`   ✅ ${deleted.count} chunks removidos`);

    console.log(`   🔄 Reindexando...`);
    const reindex = await processLegislativeAct(act.id, { forceReprocess: true });
    if (!reindex.success) {
      console.log(`   ❌ Reindex falhou: ${reindex.error}`);
    } else {
      console.log(`   ✅ ${reindex.stats?.chunkCount ?? 0} chunks gerados`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
