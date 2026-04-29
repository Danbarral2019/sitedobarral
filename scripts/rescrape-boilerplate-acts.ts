/**
 * Re-scrape de LegislativeAct cujo `content` ainda contém boilerplate da UI
 * gov.br/MGI ("link para Copiar", "Publicado em hh:mm", "Perguntas e respostas").
 * O `stripGovbrUiNoise` em lib/legislative-scrapers/normalize.ts foi estendido
 * para remover esses padrões.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/rescrape-boilerplate-acts.ts            # dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/rescrape-boilerplate-acts.ts --apply
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { scrapeAndIndexAct } from '@/lib/legislative-scrapers/scrape-and-index';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes('--apply');
const DELAY_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const ids = await prisma.$queryRaw<Array<{ id: string; fullNumber: string; officialUrl: string | null }>>`
    SELECT "id", "fullNumber", "officialUrl"
    FROM "LegislativeAct"
    WHERE "content" ~ '(link para Copiar|Perguntas e respostas - (?:IN|Portaria|Decreto)|^Publicado em\s|^Atualizado em\s)'
      AND "officialUrl" IS NOT NULL
      AND ("scrapeStatus" IS NULL OR "scrapeStatus" != 'manual')
    ORDER BY "publishDate" DESC
  `;

  console.log(`=== Re-scrape de atos com boilerplate gov.br/MGI ===`);
  console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Atos afetados: ${ids.length}\n`);

  if (!APPLY) {
    for (const a of ids.slice(0, 30)) console.log(`  would rescrape: ${a.fullNumber}`);
    if (ids.length > 30) console.log(`  … (mais ${ids.length - 30})`);
    console.log(`\n(dry-run — re-execute com --apply)`);
    await prisma.$disconnect();
    return;
  }

  let ok = 0, fail = 0;
  for (let i = 0; i < ids.length; i++) {
    const a = ids[i];
    console.log(`[${i + 1}/${ids.length}] ${a.fullNumber}`);
    try {
      const result = await scrapeAndIndexAct(a.id);
      if (result.scraped) { ok++; console.log(`  ✅ scraped${result.indexed ? ' + indexed' : ''}`); }
      else { fail++; console.log(`  ❌ ${result.error ?? '?'}`); }
    } catch (err) {
      fail++;
      console.log(`  ❌ ${err instanceof Error ? err.message : err}`);
    }
    if (i < ids.length - 1) await sleep(DELAY_MS);
  }
  console.log(`\nResumo: ${ok} ok / ${fail} falhas`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
