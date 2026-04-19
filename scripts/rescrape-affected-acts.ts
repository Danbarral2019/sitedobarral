/**
 * Re-scrape dos atos afetados pelos fixes (Bundle A de T1).
 *
 * Seleciona IDs a partir do JSON da auditoria:
 *   - spotCheckSuspicious: atos com verdict != ok
 *   - Atos com scrapeStatus null (opcional via flag)
 *
 * Para cada ID: chama scrapeAndIndexAct com 2s de delay.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/rescrape-affected-acts.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/rescrape-affected-acts.ts --include-null-status
 *   npx dotenv -e .env.local -- npx tsx scripts/rescrape-affected-acts.ts --dry-run
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { scrapeAndIndexAct } from '@/lib/legislative-scrapers/scrape-and-index';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const INCLUDE_NULL = process.argv.includes('--include-null-status');
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const auditPath = path.join(process.cwd(), 'docs', 'audits', '2026-04-19-legislative-acts-audit.json');
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));

  const ids = new Set<string>();
  for (const row of audit.spotCheck ?? []) {
    if (row.verdict !== 'ok') ids.add(row.id);
  }

  if (INCLUDE_NULL) {
    const nullStatusActs = await prisma.legislativeAct.findMany({
      where: { scrapeStatus: null, officialUrl: { not: null } },
      select: { id: true },
    });
    for (const a of nullStatusActs) ids.add(a.id);
  }

  const idList = Array.from(ids);
  console.log(`Re-scrape de ${idList.length} atos (include-null-status=${INCLUDE_NULL}, dry-run=${DRY_RUN})`);

  if (DRY_RUN) {
    for (const id of idList) {
      const act = await prisma.legislativeAct.findUnique({
        where: { id },
        select: { fullNumber: true, officialUrl: true },
      });
      console.log(`  would rescrape: ${act?.fullNumber} → ${act?.officialUrl}`);
    }
    return;
  }

  let ok = 0, fail = 0;
  for (let i = 0; i < idList.length; i++) {
    const id = idList[i];
    const act = await prisma.legislativeAct.findUnique({
      where: { id },
      select: { fullNumber: true, officialUrl: true },
    });
    console.log(`[${i + 1}/${idList.length}] ${act?.fullNumber} → ${act?.officialUrl}`);

    const result = await scrapeAndIndexAct(id);
    if (result.scraped) {
      console.log(`  ✓ scraped${result.indexed ? ' + indexed' : ''}`);
      ok++;
    } else {
      console.log(`  ✗ failed: ${result.error ?? 'unknown'}`);
      fail++;
    }

    if (i < idList.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nResumo: ${ok} OK, ${fail} falharam, ${idList.length} total.`);
}

main()
  .catch((err) => {
    console.error('ERRO:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
