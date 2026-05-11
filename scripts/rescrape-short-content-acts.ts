/**
 * Re-scrape de atos com warning "Conteúdo curto" da auditoria 2026-05-01.
 *
 * Lista de atos com content < ~1500 chars sinalizada nos audits.
 * Tenta re-scrape pra ver se o parser atual extrai mais texto que o existente.
 * Se sim, atualiza. Se não, mantém (pode ser conteúdo legitimamente curto).
 *
 * Uso:
 *   npx tsx scripts/rescrape-short-content-acts.ts            # dry-run
 *   npx tsx scripts/rescrape-short-content-acts.ts --apply    # aplica
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

const TARGETS = [
  // Decretos
  'Decreto 10.309/2020',
  'Decreto 9.745/2019',
  'Decreto 7.930/2013',
  // INs
  'IN SEGES/MGI 129/2026',
  'IN SEGES/MGI 381/2025',
  'IN SEGES/MGI 11/2023',
  'IN SEGES/ME 98/2022',
  'IN SEGES/ME 91/2022',
  'IN SEGES 90/2022',
  'IN SEGES 20/2022',
  'IN MP 76/2020',
  'IN MP 64/2020',
  'IN MP 50/2020',
  'IN MP 16/2020',
  'IN MP 210/2019',
  'IN MP 5/2018',
  'IN MP 12/1997',
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const acts = await prisma.legislativeAct.findMany({
    where: { fullNumber: { in: TARGETS } },
    select: { id: true, fullNumber: true, content: true, officialUrl: true, scrapeStatus: true },
  });

  console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`${acts.length}/${TARGETS.length} atos encontrados no DB`);
  console.log();

  const results: Array<{
    fullNumber: string;
    before: number;
    after: number | null;
    delta: number | null;
    verdict: string;
  }> = [];

  for (const act of acts) {
    const before = act.content?.length ?? 0;
    if (act.scrapeStatus === 'manual') {
      console.log(`⏭️  ${act.fullNumber}: scrapeStatus=manual, pulando`);
      results.push({ fullNumber: act.fullNumber, before, after: null, delta: null, verdict: 'skipped-manual' });
      continue;
    }
    if (!act.officialUrl) {
      console.log(`⚠️  ${act.fullNumber}: sem officialUrl`);
      results.push({ fullNumber: act.fullNumber, before, after: null, delta: null, verdict: 'no-url' });
      continue;
    }

    console.log(`▶ ${act.fullNumber} (${before} chars) → ${act.officialUrl}`);

    if (!APPLY) {
      console.log(`  (dry-run, skipping fetch)`);
      results.push({ fullNumber: act.fullNumber, before, after: null, delta: null, verdict: 'dry-run' });
      continue;
    }

    try {
      const result = await scrapeAndIndexAct(act.id);
      const after = await prisma.legislativeAct.findUnique({
        where: { id: act.id },
        select: { content: true },
      });
      const afterLen = after?.content?.length ?? 0;
      const delta = afterLen - before;
      const status = result.error
        ? `error: ${result.error}`
        : result.indexed
          ? 'scraped+indexed'
          : result.scraped
            ? 'scraped-only'
            : 'noop';
      console.log(`  ✓ ${status} | ${before} → ${afterLen} chars (Δ ${delta >= 0 ? '+' : ''}${delta})`);
      results.push({
        fullNumber: act.fullNumber,
        before,
        after: afterLen,
        delta,
        verdict: status,
      });
    } catch (e) {
      console.log(`  ✗ erro: ${(e as Error).message}`);
      results.push({ fullNumber: act.fullNumber, before, after: null, delta: null, verdict: 'error' });
    }

    await sleep(DELAY_MS);
  }

  console.log('\n=== Resumo ===');
  const improved = results.filter((r) => r.delta !== null && r.delta > 200);
  const same = results.filter((r) => r.delta !== null && Math.abs(r.delta) <= 200);
  const worse = results.filter((r) => r.delta !== null && r.delta < -200);
  console.log(`Melhoraram (Δ > 200 chars): ${improved.length}`);
  improved.forEach((r) => console.log(`  • ${r.fullNumber}: ${r.before} → ${r.after} (+${r.delta})`));
  console.log(`Sem mudança significativa: ${same.length}`);
  console.log(`Pioraram: ${worse.length}`);
  worse.forEach((r) => console.log(`  • ${r.fullNumber}: ${r.before} → ${r.after} (${r.delta})`));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
