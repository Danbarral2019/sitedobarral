/**
 * Re-scrape Portaria SEGES/MGI 4.932/2023 (309 chars — falha histórica).
 */
import { prisma } from '../lib/prisma';
import { scrapeUrl } from '../lib/legislative-scrapers';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { processLegislativeAct } from '../lib/embeddings/legislative-act-processor';

async function main() {
  const apply = process.argv.includes('--apply');
  const act = await prisma.legislativeAct.findUnique({ where: { fullNumber: 'Portaria SEGES/MGI 4.932/2023' } });
  if (!act) {
    console.log('NÃO ENCONTRADO');
    process.exit(1);
  }
  console.log(`📋 ${act.fullNumber}`);
  console.log(`   chars atuais: ${act.content?.length ?? 0}`);
  console.log(`   url:          ${act.officialUrl}`);

  const result = await scrapeUrl(act.officialUrl!);
  if (!result.success) {
    console.log(`❌ Scrape falhou: ${result.error}`);
    process.exit(1);
  }
  console.log(`   ✅ ${result.content?.length ?? 0} chars novos`);
  console.log(`   início: "${result.content?.slice(0, 200)?.replace(/\n/g, ' ')}..."`);

  const validation = validateActContent({ url: act.officialUrl!, content: result.content });
  if (validation.errors.length) {
    console.log('🚫 Validação falhou:');
    for (const e of validation.errors) console.log(`   ❌ ${e}`);
    process.exit(1);
  }
  for (const w of validation.warnings) console.log(`   ⚠️  ${w}`);

  if (!apply) {
    console.log('🔒 dry-run');
    await prisma.$disconnect();
    return;
  }

  if ((result.content?.length ?? 0) <= (act.content?.length ?? 0)) {
    console.log(`⏭️  novo content não é maior, skip`);
    await prisma.$disconnect();
    return;
  }

  await prisma.legislativeAct.update({
    where: { id: act.id },
    data: {
      content: result.content,
      contentHash: result.hash ?? result.contentHash,
      embeddingStatus: 'pending',
      scrapeStatus: 'success',
      lastScrapedAt: new Date(),
    },
  });
  const deleted = await prisma.legislativeActChunk.deleteMany({ where: { legislativeActId: act.id } });
  console.log(`   ✅ ${deleted.count} chunks removidos`);
  const reindex = await processLegislativeAct(act.id, { forceReprocess: true });
  console.log(`   🧠 ${reindex.stats?.chunkCount ?? 0} chunks novos`);

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
