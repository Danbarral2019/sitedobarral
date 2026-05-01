/**
 * Normaliza tribunalCode pra UPPERCASE em todas as TribunalDecision.
 *
 * Bug original: scrapers antigos salvavam em lowercase ("tcu", "tce-pe"),
 * mas API e clients novos usam UPPERCASE ("TCU", "TCE-PE"). Filtro por
 * tribunal estava quebrado pra público (z.enum reject lowercase) e
 * retornava 0 resultados pra restrita (DB lookup miss).
 *
 * Modos: dry-run | --apply
 */
import { prisma } from '../lib/prisma';

async function main() {
  const apply = process.argv.includes('--apply');
  const decisions = await prisma.tribunalDecision.groupBy({
    by: ['tribunalCode'],
    _count: true,
  });

  const lowercase = decisions.filter((d) => d.tribunalCode !== d.tribunalCode.toUpperCase());
  console.log(`📋 ${decisions.length} tribunalCodes únicos no DB:`);
  for (const d of decisions) {
    const tag = d.tribunalCode === d.tribunalCode.toUpperCase() ? '✅' : '⚠️ ';
    console.log(`   ${tag} ${d.tribunalCode.padEnd(20)} ${d._count}`);
  }
  console.log(`\n${lowercase.length} grupo(s) precisam normalização (${apply ? 'APPLY' : 'dry-run'}):`);

  if (lowercase.length === 0) {
    console.log('✅ Nada a fazer.');
    await prisma.$disconnect();
    return;
  }

  for (const d of lowercase) {
    const newCode = d.tribunalCode.toUpperCase();
    console.log(`   "${d.tribunalCode}" → "${newCode}" (${d._count} decisões)`);
    if (apply) {
      const result = await prisma.tribunalDecision.updateMany({
        where: { tribunalCode: d.tribunalCode },
        data: { tribunalCode: newCode },
      });
      console.log(`   💾 ${result.count} updates`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
