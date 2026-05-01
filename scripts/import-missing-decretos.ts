/**
 * Importa decretos faltantes do gov.br/compras lista oficial.
 * Foco: regulamentações da Lei 14.133/2021.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/import-missing-decretos.ts          # dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/import-missing-decretos.ts --apply
 */
import { prisma } from '../lib/prisma';
import { scrapeUrl } from '../lib/legislative-scrapers';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { processLegislativeAct } from '../lib/embeddings/legislative-act-processor';

interface DecretoToImport {
  number: string;
  year: number;
  title: string;
  url: string;
  ementa: string;
  publishDate: string; // ISO yyyy-mm-dd
  hierarchyLevel: 2; // decreto = 2
}

const DECRETOS: DecretoToImport[] = [
  {
    number: '11.317',
    year: 2022,
    title: 'DECRETO Nº 11.317, DE 29 DE DEZEMBRO DE 2022',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/D11317.htm',
    ementa: 'Atualiza os valores estabelecidos na Lei nº 14.133, de 1º de abril de 2021. (Revogado pelo Decreto nº 11.871, de 29 de dezembro de 2023.)',
    publishDate: '2022-12-29',
    hierarchyLevel: 2,
  },
];

async function main() {
  const apply = process.argv.includes('--apply');

  for (const d of DECRETOS) {
    const fullNumber = `Decreto ${d.number}/${d.year}`;
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📋 ${fullNumber} — ${d.ementa.slice(0, 80)}`);

    const existing = await prisma.legislativeAct.findFirst({
      where: { type: 'decreto', number: d.number, year: d.year },
    });
    if (existing) {
      console.log(`   ⏭️  Já existe: ${existing.fullNumber}`);
      continue;
    }

    console.log(`   🌐 Scraping ${d.url}`);
    const result = await scrapeUrl(d.url);
    if (!result.success) {
      console.log(`   ❌ Scrape falhou: ${result.error}`);
      continue;
    }
    console.log(`   ✅ ${result.content?.length ?? 0} chars`);

    const validation = validateActContent({ url: d.url, content: result.content });
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

    const created = await prisma.legislativeAct.create({
      data: {
        type: 'decreto',
        number: d.number,
        year: d.year,
        fullNumber,
        title: d.title,
        ementa: d.ementa,
        issuer: 'Presidência',
        publishDate: new Date(d.publishDate + 'T00:00:00Z'),
        hierarchyLevel: d.hierarchyLevel,
        officialUrl: d.url,
        content: result.content,
        contentHash: result.hash ?? result.contentHash,
        esfera: 'federal',
        embeddingStatus: 'pending',
        scrapeStatus: 'success',
        lastScrapedAt: new Date(),
      },
    });
    console.log(`   ✨ Criado: ${created.id}`);

    const reindex = await processLegislativeAct(created.id, { forceReprocess: true });
    if (reindex.success) {
      console.log(`   🧠 ${reindex.stats?.chunkCount ?? 0} chunks`);
    } else {
      console.log(`   ⚠️ Reindex: ${reindex.error}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
