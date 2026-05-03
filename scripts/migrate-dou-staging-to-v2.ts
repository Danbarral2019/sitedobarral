/**
 * Migração da fila DOUStagingDocument legacy pro Clipping v2.
 *
 * Marca todos pending (sem finalDecision e sem editorialScore) como
 * rejected-migration. Não deleta — preserva audit trail. Idempotente.
 *
 * Uso:
 *   npx tsx scripts/migrate-dou-staging-to-v2.ts --dry-run
 *   npx tsx scripts/migrate-dou-staging-to-v2.ts
 */

import 'dotenv/config';
import { prisma } from '../lib/prisma';

const NOTE = 'auto-rejeitado em migração v2 do classificador (2026-05-03)';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const targets = await prisma.dOUStagingDocument.findMany({
    where: {
      finalDecision: null,
      imported: false,
      editorialScore: null, // só itens legados, não criados pelo v2
    },
    select: { id: true, title: true, createdAt: true },
  });

  console.log(`[migrate-v2] ${targets.length} stagings legados pra rejeitar (dryRun=${dryRun})`);

  if (dryRun) {
    targets.slice(0, 10).forEach((t) => console.log(`  - ${t.id} :: ${t.title.substring(0, 80)}`));
    if (targets.length > 10) console.log(`  ...e mais ${targets.length - 10}`);
    return;
  }

  // Update em batch único — sem laço
  const result = await prisma.dOUStagingDocument.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: {
      finalDecision: 'rejected',
      reviewedAt: new Date(),
      reviewedBy: 'migration',
      adminNotes: NOTE,
    },
  });

  console.log(`[migrate-v2] ✅ ${result.count} stagings marcados como rejected.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
