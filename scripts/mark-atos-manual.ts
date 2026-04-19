/**
 * Marca atos com scrapeStatus = 'manual' para bloqueá-los de re-scrape
 * automático (cron, scripts batch) e evitar falso-positivos na auditoria.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/mark-atos-manual.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/mark-atos-manual.ts --dry-run
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');

const MANUAL_FULL_NUMBERS: string[] = [
  'Portaria TCU 3/2025',
  'Portaria TCU 175/2022',
];

async function main() {
  console.log(`Marcando ${MANUAL_FULL_NUMBERS.length} atos como 'manual' (dry-run=${DRY_RUN})`);

  for (const fullNumber of MANUAL_FULL_NUMBERS) {
    const act = await prisma.legislativeAct.findFirst({
      where: { fullNumber },
      select: { id: true, fullNumber: true, scrapeStatus: true, content: true },
    });

    if (!act) {
      console.log(`  ✗ ${fullNumber}: ato NÃO encontrado no banco`);
      continue;
    }

    if (act.scrapeStatus === 'manual') {
      console.log(`  = ${fullNumber}: já está como 'manual' (no-op)`);
      continue;
    }

    const contentLen = act.content?.length ?? 0;
    if (contentLen < 500) {
      console.log(`  ⚠ ${fullNumber}: content length=${contentLen} (suspeito — deveria ter conteúdo substantivo). Marcando mesmo assim.`);
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] would update ${fullNumber} (${act.scrapeStatus ?? 'null'} → manual)`);
      continue;
    }

    await prisma.legislativeAct.update({
      where: { id: act.id },
      data: {
        scrapeStatus: 'manual',
        scrapeError: null,
      },
    });
    console.log(`  ✓ ${fullNumber} marcado como 'manual' (era '${act.scrapeStatus ?? 'null'}')`);
  }
}

main()
  .catch((err) => {
    console.error('ERRO:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
