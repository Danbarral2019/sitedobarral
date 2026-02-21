/**
 * Gera resumos IA para decisões de tribunais aprovadas que ainda não têm resumo.
 * Uso: npx tsx --env-file=.env.local scripts/generate-decision-summaries.ts [--tribunal tce-pe] [--limit 50] [--dry-run]
 */

import { prisma } from '@/lib/prisma';
import { generateDecisionSummary } from '@/lib/tribunal-scrapers/classifier';

async function main() {
  const args = process.argv.slice(2);
  const tribunalFilter = args.includes('--tribunal') ? args[args.indexOf('--tribunal') + 1] : null;
  const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : 100;
  const dryRun = args.includes('--dry-run');

  console.log('=== Geração de Resumos IA para Decisões de Tribunais ===\n');
  if (dryRun) console.log('(DRY RUN - nenhuma alteração será feita)\n');

  // Find approved decisions without summary
  const decisions = await prisma.tribunalDecision.findMany({
    where: {
      summary: null,
      approvalStatus: { in: ['auto_approved', 'manually_approved'] },
      ...(tribunalFilter ? { tribunalCode: tribunalFilter } : {}),
    },
    select: {
      id: true,
      tribunalCode: true,
      decisionNumber: true,
      title: true,
      ementa: true,
      fullText: true,
      decisionType: true,
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Encontradas ${decisions.length} decisões sem resumo${tribunalFilter ? ` (${tribunalFilter})` : ''}\n`);

  if (decisions.length === 0) {
    console.log('Nenhuma decisão para processar.');
    process.exit(0);
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < decisions.length; i++) {
    const d = decisions[i];
    const label = `[${i + 1}/${decisions.length}] ${d.tribunalCode} ${d.decisionNumber}`;

    try {
      const summary = await generateDecisionSummary({
        title: d.title,
        ementa: d.ementa,
        fullText: d.fullText,
        decisionType: d.decisionType,
      });

      if (!summary) {
        console.log(`${label} — SKIP (texto insuficiente)`);
        skipped++;
        continue;
      }

      if (!dryRun) {
        await prisma.tribunalDecision.update({
          where: { id: d.id },
          data: { summary },
        });
      }

      console.log(`${label} — OK (${summary.length} chars)`);
      console.log(`  "${summary.slice(0, 120)}..."\n`);
      success++;

      // Rate limit: ~1 request/second
      if (i < decisions.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (error) {
      console.error(`${label} — ERRO: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  console.log('\n=== RESUMO ===');
  console.log(`Processadas: ${decisions.length}`);
  console.log(`Sucesso: ${success}`);
  console.log(`Falhas: ${failed}`);
  console.log(`Puladas: ${skipped}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
