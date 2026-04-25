/**
 * Verifica quantos atos do batch ins-faltantes-2026-02 precisam de
 * re-scrape de content (URL sim, content vazio/curto).
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const json = JSON.parse(readFileSync('ins-faltantes-2026-02.json', 'utf-8'));
  const fullNumbers = (json.legislativeActs as Array<{ fullNumber: string }>).map((a) => a.fullNumber);

  const acts = await prisma.legislativeAct.findMany({
    where: { fullNumber: { in: fullNumbers } },
    select: { fullNumber: true, officialUrl: true, content: true, themes: true },
  });

  let withUrl = 0;
  let withContent = 0;
  let needsScrape = 0;
  let withThemes = 0;
  const noUrl: string[] = [];
  const needsScrapeList: string[] = [];

  for (const a of acts) {
    const hasContent = a.content !== null && a.content.length > 100;
    if (a.officialUrl) withUrl++; else noUrl.push(a.fullNumber);
    if (hasContent) withContent++;
    if (a.themes !== null) withThemes++;
    if (a.officialUrl && !hasContent) {
      needsScrape++;
      needsScrapeList.push(a.fullNumber);
    }
  }

  console.log(`Atos do JSON: ${acts.length}`);
  console.log(`  Com officialUrl:           ${withUrl}`);
  console.log(`  Sem officialUrl:           ${noUrl.length}  ${noUrl.length > 0 ? '(não dá pra rescrape)' : ''}`);
  console.log(`  Com themes (pós-enrich):   ${withThemes}`);
  console.log(`  Com content (>100 chars):  ${withContent}`);
  console.log(`  Precisam re-scrape:        ${needsScrape}`);

  if (noUrl.length > 0) {
    console.log('\nSem officialUrl:');
    for (const fn of noUrl) console.log(`  - ${fn}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
