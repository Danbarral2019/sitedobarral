/**
 * Script para gerar summaries IA em decisões de tribunais que não possuem.
 * Uso: npx dotenv -e .env.local -- npx tsx scripts/backfill-summaries.ts [--limit 50] [--dry-run]
 */

import { prisma } from '@/lib/prisma';
import { generateDecisionSummary } from '@/lib/tribunal-scrapers/classifier';

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : 100;
  const dryRun = args.includes('--dry-run');

  console.log(`=== Backfill de Summaries IA ===`);
  console.log(`Limite: ${limit} | Dry run: ${dryRun}\n`);

  // Buscar decisões aprovadas sem summary
  const decisions = await prisma.tribunalDecision.findMany({
    where: {
      summary: null,
      approvalStatus: { in: ['auto_approved', 'manually_approved'] },
    },
    select: {
      id: true,
      title: true,
      ementa: true,
      fullText: true,
      decisionType: true,
      tribunalCode: true,
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Encontradas ${decisions.length} decisões sem summary.\n`);

  if (dryRun) {
    for (const d of decisions) {
      console.log(`  [${d.tribunalCode}] ${d.title} (ementa: ${d.ementa.length} chars)`);
    }
    console.log('\n(dry-run — nenhuma alteração feita)');
    await prisma.$disconnect();
    return;
  }

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < decisions.length; i++) {
    const d = decisions[i];
    const progress = `[${i + 1}/${decisions.length}]`;

    try {
      const summary = await generateDecisionSummary({
        title: d.title,
        ementa: d.ementa,
        fullText: d.fullText,
        decisionType: d.decisionType,
        tribunalCode: d.tribunalCode,
      });

      if (summary) {
        await prisma.tribunalDecision.update({
          where: { id: d.id },
          data: { summary },
        });
        console.log(`${progress} ✅ ${d.tribunalCode} — ${d.title.slice(0, 60)}`);
        generated++;
      } else {
        console.log(`${progress} ⏭️  ${d.tribunalCode} — texto insuficiente`);
        skipped++;
      }

      // Rate limiting: 200ms entre chamadas para não exceder quota do Gemini
      if (i < decisions.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${progress} ❌ ${d.tribunalCode} — ${msg}`);
      errors++;

      // Se for rate limit, esperar mais
      if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) {
        console.log('  ⏳ Rate limit — esperando 10s...');
        await new Promise(r => setTimeout(r, 10000));
      }
    }
  }

  console.log(`\n=== RESUMO ===`);
  console.log(`Gerados: ${generated}`);
  console.log(`Texto insuficiente: ${skipped}`);
  console.log(`Erros: ${errors}`);
  console.log(`Total processados: ${decisions.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
