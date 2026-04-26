/**
 * Backfill de relações pra todos os atos já existentes no DB.
 * Roda detectAmendments em (ementa + content) e persiste via saveDetectedRelations.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-relations.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-relations.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-relations.ts --limit 10
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { detectAmendments } from '../lib/legislative-acts/amendment-detector';
import {
  detectAndSaveRelationsHybrid,
  saveDetectedRelations,
} from '../lib/legislative-acts/relations';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArgIdx = args.indexOf('--limit');
const LIMIT = limitArgIdx >= 0 ? parseInt(args[limitArgIdx + 1] ?? '0', 10) : 0;

async function main() {
  const aiEnabled = process.env.DETECT_AMENDMENTS_AI === 'true';
  const premium = process.env.USE_PREMIUM_FOR_DETECTOR === 'true';
  console.log(
    `\n=== Backfill de relações ${DRY_RUN ? '[DRY-RUN]' : '[EXEC]'} ` +
      `${aiEnabled ? `[AI ${premium ? '3.1-Pro' : '3-Flash'}]` : '[heurística-only]'} ===\n`,
  );

  const acts = await prisma.legislativeAct.findMany({
    select: { id: true, fullNumber: true, ementa: true, content: true },
    ...(LIMIT > 0 ? { take: LIMIT } : {}),
  });
  console.log(`Atos a processar: ${acts.length}\n`);

  let totalDetected = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalAiAdded = 0;

  for (const act of acts) {
    const heuristic = detectAmendments(act.ementa, act.content || '');
    if (heuristic.length === 0) continue;

    if (DRY_RUN) {
      totalDetected += heuristic.length;
      console.log(`${act.fullNumber}: ${heuristic.length} candidatos heurística`);
      for (const d of heuristic) console.log(`  - ${d.relationType} → ${d.targetFullNumber} (conf=${d.confidence})`);
      continue;
    }

    if (aiEnabled) {
      const r = await detectAndSaveRelationsHybrid(
        act.id,
        act.ementa,
        act.content || '',
      );
      totalDetected += r.heuristicCount + r.aiAdded;
      totalCreated += r.created;
      totalSkipped += r.skipped;
      totalAiAdded += r.aiAdded;
      if (r.created > 0 || r.skipped > 0 || r.aiAdded > 0) {
        console.log(
          `${act.fullNumber}: +${r.created} criadas, ${r.skipped} puladas, ${r.aiAdded} adicionadas pela IA`,
        );
      }
    } else {
      totalDetected += heuristic.length;
      const r = await saveDetectedRelations(act.id, heuristic, 'heuristica');
      totalCreated += r.created;
      totalSkipped += r.skipped;
      if (r.created > 0 || r.skipped > 0) {
        console.log(`${act.fullNumber}: +${r.created} criadas, ${r.skipped} puladas`);
      }
    }
  }

  console.log(`\n=== Total ===`);
  console.log(`Candidatos detectados: ${totalDetected}`);
  console.log(`Relações criadas:      ${totalCreated}`);
  console.log(`Pulados (orphan/self): ${totalSkipped}`);
  if (aiEnabled) {
    console.log(`Adicionadas pela IA:   ${totalAiAdded}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
