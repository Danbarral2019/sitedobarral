/**
 * Atualiza a officialUrl da IN SEGES/MGI 52/2025 do portal antigo
 * (contratamaisbrasil) pro portal atual (compras/.../legislacao).
 * Re-scrape pra pegar texto da URL nova caso tenha sido atualizada.
 */
import { prisma } from '../lib/prisma';
import { GovBrComprasScraper } from '../lib/legislative-scrapers/govbr-compras';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { processLegislativeAct } from '../lib/embeddings/legislative-act-processor';

const FULL_NUMBER = 'IN SEGES/MGI 52/2025';
const NEW_URL =
  'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-52-de-10-de-fevereiro-de-2025-1';

async function main() {
  const apply = process.argv.includes('--apply');
  const act = await prisma.legislativeAct.findUnique({ where: { fullNumber: FULL_NUMBER } });
  if (!act) {
    console.error('NÃO ENCONTRADO');
    process.exit(1);
  }
  console.log(`📋 ${FULL_NUMBER}`);
  console.log(`   URL atual:    ${act.officialUrl}`);
  console.log(`   URL oficial:  ${NEW_URL}`);
  console.log(`   chars atuais: ${act.content?.length ?? 0}`);
  console.log();

  console.log('🌐 Scrapando URL oficial...');
  const scraper = new GovBrComprasScraper();
  const result = await scraper.scrape(NEW_URL);
  if (!result.success) {
    console.error(`❌ Scrape falhou: ${result.error}`);
    process.exit(1);
  }
  console.log(`   ✅ ${result.content?.length ?? 0} chars extraídos`);
  console.log(`   início: "${result.content?.slice(0, 200)?.replace(/\n/g, ' ')}..."`);

  const validation = validateActContent({ url: NEW_URL, content: result.content });
  if (validation.errors.length) {
    console.log('🚫 Validação falhou:');
    for (const e of validation.errors) console.log(`   ❌ ${e}`);
    process.exit(1);
  }
  for (const w of validation.warnings) console.log(`   ⚠️  ${w}`);

  if (!apply) {
    console.log('\n🔒 dry-run — use --apply pra atualizar');
    await prisma.$disconnect();
    return;
  }

  console.log('\n💾 Atualizando DB...');
  await prisma.legislativeAct.update({
    where: { id: act.id },
    data: {
      officialUrl: NEW_URL,
      content: result.content,
      contentHash: result.contentHash,
      embeddingStatus: 'pending',
    },
  });

  const deleted = await prisma.legislativeActChunk.deleteMany({ where: { legislativeActId: act.id } });
  console.log(`   ✅ ${deleted.count} chunks removidos`);

  const reindex = await processLegislativeAct(act.id, { forceReprocess: true });
  console.log(`   ✅ ${reindex.stats?.chunkCount ?? 0} chunks novos`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
