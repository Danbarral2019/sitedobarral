/**
 * Re-scrape de atos cujo content armazenado contém padrões de ruído
 * corrigidos em Bundle A (F4/F5/F6).
 *
 * Padrões alvo:
 *   - "Brasão do Brasil" (masthead DOU não removido)
 *   - "Borda do rodapé" (footer DOU não removido)
 *   - "<NOME DO FISCAL TECNICO>" etc (form annex)
 *   - 3+ \n consecutivos (whitespace noise)
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/rescrape-by-content-pattern.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/rescrape-by-content-pattern.ts --dry-run
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { scrapeAndIndexAct } from '@/lib/legislative-scrapers/scrape-and-index';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const NOISE_PATTERNS = [
  'Brasão do Brasil',
  'Borda do rodapé',
  '<NOME DO FISCAL TECNICO>',
  '<NOME DO GESTOR>',
  '<NOME DO PREPOSTO>',
];

async function main() {
  // Buscar atos com content match em qualquer pattern OU com 3+ \n consecutivos
  const all = await prisma.legislativeAct.findMany({
    where: {
      officialUrl: { not: null },
      content: { not: null },
      scrapeStatus: { not: 'manual' },
    },
    select: { id: true, fullNumber: true, officialUrl: true, content: true },
  });

  const ids: { id: string; fullNumber: string; officialUrl: string; reason: string }[] = [];
  for (const a of all) {
    const c = a.content ?? '';
    let reason: string | null = null;
    for (const pat of NOISE_PATTERNS) {
      if (c.includes(pat)) { reason = `contains "${pat}"`; break; }
    }
    if (!reason && /\n{3,}/.test(c)) reason = '3+ consecutive newlines';
    if (reason) {
      ids.push({ id: a.id, fullNumber: a.fullNumber, officialUrl: a.officialUrl!, reason });
    }
  }

  console.log(`Encontrados ${ids.length} atos com content sujo (dry-run=${DRY_RUN}).`);
  for (const x of ids) console.log(`  [${x.reason}] ${x.fullNumber}`);

  if (DRY_RUN) return;

  let ok = 0, fail = 0;
  for (let i = 0; i < ids.length; i++) {
    const x = ids[i];
    console.log(`\n[${i + 1}/${ids.length}] ${x.fullNumber} → ${x.officialUrl}`);
    const result = await scrapeAndIndexAct(x.id);
    if (result.scraped) {
      console.log(`  ✓ scraped${result.indexed ? ' + indexed' : ''}`);
      ok++;
    } else {
      console.log(`  ✗ failed: ${result.error ?? 'unknown'}`);
      fail++;
    }
    if (i < ids.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nResumo: ${ok} OK, ${fail} falharam, ${ids.length} total.`);
}

main()
  .catch((err) => { console.error('ERRO:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
