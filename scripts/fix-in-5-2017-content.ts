/**
 * Corrige a IN SEGES/MP 5/2017 que estava com FAQ ao invés do texto oficial.
 *
 * Bug histórico: o `officialUrl` apontava pra `/perguntas-frequentes/...`
 * (página de FAQ), então o conteúdo armazenado eram perguntas e respostas.
 *
 * URL correta: /legislacao/instrucoes-normativas/instrucao-normativa-no-5-de-26-de-maio-de-2017-atualizada
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/fix-in-5-2017-content.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/fix-in-5-2017-content.ts --apply
 */

import { prisma } from '../lib/prisma';
import { GovBrComprasScraper } from '../lib/legislative-scrapers/govbr-compras';
import { processLegislativeAct } from '../lib/embeddings/legislative-act-processor';

const ACT_ID = '16184659-7248-4b8a-b34f-3f561fa723d4';
const NEW_URL =
  'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-5-de-26-de-maio-de-2017-atualizada';

async function main() {
  const apply = process.argv.includes('--apply');

  console.log(`🔍 Buscando ato ${ACT_ID} no banco...`);
  const act = await prisma.legislativeAct.findUnique({ where: { id: ACT_ID } });
  if (!act) {
    console.error('❌ Ato não encontrado');
    process.exit(1);
  }
  console.log(`   ${act.fullNumber} — ${act.title?.slice(0, 80)}`);
  console.log(`   officialUrl atual: ${act.officialUrl}`);
  console.log(`   content atual:    ${act.content?.length ?? 0} chars`);
  console.log(`   começa com:       "${act.content?.slice(0, 80)?.replace(/\n/g, ' ')}..."`);
  console.log();

  console.log(`🌐 Scrapeando nova URL: ${NEW_URL}`);
  const scraper = new GovBrComprasScraper();
  const result = await scraper.scrape(NEW_URL);
  if (!result.success) {
    console.error(`❌ Scrape falhou: ${result.error}`);
    process.exit(1);
  }
  console.log(`   ✅ ${result.content?.length ?? 0} chars extraídos`);
  console.log(`   começa com:       "${result.content?.slice(0, 200)?.replace(/\n/g, ' ')}..."`);
  console.log();

  if (!apply) {
    console.log('🔒 dry-run — nenhuma alteração no banco. Use --apply pra aplicar.');
    await prisma.$disconnect();
    return;
  }

  console.log('💾 Atualizando banco...');
  await prisma.legislativeAct.update({
    where: { id: ACT_ID },
    data: {
      officialUrl: NEW_URL,
      content: result.content,
      contentHash: result.contentHash,
      embeddingStatus: 'pending',
    },
  });
  console.log('   ✅ DB atualizado');
  console.log();

  console.log('🧹 Limpando chunks antigos...');
  const deleted = await prisma.legislativeActChunk.deleteMany({ where: { legislativeActId: ACT_ID } });
  console.log(`   ✅ ${deleted.count} chunks removidos`);
  console.log();

  console.log('🔄 Reindexando embeddings...');
  const reindex = await processLegislativeAct(ACT_ID, { forceReprocess: true });
  if (!reindex.success) {
    console.error(`❌ Reindex falhou: ${reindex.error}`);
    process.exit(1);
  }
  console.log(`   ✅ ${reindex.stats?.chunkCount ?? 0} chunks gerados em ${reindex.stats?.processingTime}ms`);
  console.log();

  console.log('🎉 IN 5/2017 corrigida.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
