/**
 * Corrige issues identificadas no audit dos decretos:
 * 1. Encoding bugado nos titles (`N�` → `Nº`, `1�` → `1º`)
 * 2. Decreto 9.745/2019 com content vazio — re-scrape
 * 3. Decreto 7.930/2013 com content < 1500 chars — re-scrape
 */
import { prisma } from '../lib/prisma';
import { scrapeUrl } from '../lib/legislative-scrapers';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { processLegislativeAct } from '../lib/embeddings/legislative-act-processor';

/** Substitui encoding bugado mantendo o resto intacto. */
function fixTitleEncoding(title: string): string {
  return title
    .replace(/N�/g, 'Nº')
    .replace(/(\d)�/g, '$1º')
    .replace(/^DECRETO\s+No\b/, 'DECRETO Nº'); // "No" sem sup → "Nº"
}

const TITLE_FIXES = [
  'Decreto 11.871/2023',
  'Decreto 11.345/2023',
  'Decreto 10.024/2019',
  'Decreto 9.373/2018',
  'Decreto 7.930/2013',
  'Decreto 7.546/2011',
  'Decreto 5.906/2006',
  'Decreto 2.271/1997',
  'Decreto 1.819/1996',
];

const RESCRAPE_TARGETS = [
  'Decreto 9.745/2019', // vazio
  'Decreto 7.930/2013', // curto
];

async function main() {
  const apply = process.argv.includes('--apply');

  console.log(`${'='.repeat(70)}\nFIX ENCODING DOS TITLES\n${'='.repeat(70)}`);
  for (const fullNumber of TITLE_FIXES) {
    const act = await prisma.legislativeAct.findUnique({ where: { fullNumber } });
    if (!act) {
      console.log(`   ⚠️  ${fullNumber}: não encontrado`);
      continue;
    }
    const newTitle = fixTitleEncoding(act.title);
    if (newTitle === act.title) {
      console.log(`   ✓  ${fullNumber}: já OK`);
      continue;
    }
    console.log(`   ${fullNumber}:`);
    console.log(`     antes: "${act.title}"`);
    console.log(`     depois: "${newTitle}"`);
    if (apply) {
      await prisma.legislativeAct.update({ where: { id: act.id }, data: { title: newTitle } });
      console.log(`     ✅ atualizado`);
    }
  }

  console.log(`\n${'='.repeat(70)}\nRE-SCRAPE DOS PROBLEMÁTICOS\n${'='.repeat(70)}`);
  for (const fullNumber of RESCRAPE_TARGETS) {
    console.log(`\n📋 ${fullNumber}`);
    const act = await prisma.legislativeAct.findUnique({ where: { fullNumber } });
    if (!act) {
      console.log(`   ❌ Não encontrado`);
      continue;
    }
    if (!act.officialUrl) {
      console.log(`   ⚠️  Sem officialUrl, skip`);
      continue;
    }
    console.log(`   chars atuais: ${act.content?.length ?? 0}`);
    console.log(`   url:          ${act.officialUrl}`);

    const result = await scrapeUrl(act.officialUrl);
    if (!result.success) {
      console.log(`   ❌ Scrape falhou: ${result.error}`);
      continue;
    }
    console.log(`   ✅ ${result.content?.length ?? 0} chars novos`);
    console.log(`   início: "${result.content?.slice(0, 200)?.replace(/\n/g, ' ')}..."`);

    const validation = validateActContent({ url: act.officialUrl, content: result.content });
    if (validation.errors.length) {
      console.log(`   🚫 Validação falhou:`);
      for (const e of validation.errors) console.log(`      ${e}`);
      continue;
    }
    if (validation.warnings.length) {
      console.log(`   ⚠️  Warnings:`);
      for (const w of validation.warnings) console.log(`      ${w}`);
    }

    if (!apply) {
      console.log(`   🔒 dry-run`);
      continue;
    }

    if ((result.content?.length ?? 0) <= (act.content?.length ?? 0)) {
      console.log(`   ⏭️  novo content não é maior, skip`);
      continue;
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
    if (reindex.success) {
      console.log(`   🧠 ${reindex.stats?.chunkCount ?? 0} chunks novos`);
    } else {
      console.log(`   ⚠️  Reindex falhou: ${reindex.error}`);
    }
  }

  if (!apply) console.log(`\n🔒 dry-run — use --apply pra escrever no DB`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
