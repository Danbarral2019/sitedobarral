/**
 * Normaliza o campo `issuer` de todos os LegislativeAct pra forma canônica
 * (lib/legislative-acts/issuers.ts). One-shot — pode ser rerodado idempotente
 * (se já está canônico, é no-op).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/normalize-issuers.ts          # dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/normalize-issuers.ts --apply
 */
import { prisma } from '../lib/prisma';
import { normalizeIssuer, isCanonicalIssuer } from '../lib/legislative-acts/issuers';
import { CacheInvalidation } from '../lib/cache/redis-client';

async function main() {
  const apply = process.argv.includes('--apply');

  const acts = await prisma.legislativeAct.findMany({
    select: { id: true, fullNumber: true, issuer: true },
  });

  console.log(`📊 ${acts.length} atos no banco. Analisando...\n`);

  // Agrupar por mudança proposta
  const changes = new Map<string, { from: string; to: string; ids: string[] }>();
  let unchanged = 0;
  const errors: { fullNumber: string; issuer: string; error: string }[] = [];

  for (const act of acts) {
    if (isCanonicalIssuer(act.issuer)) {
      unchanged++;
      continue;
    }
    try {
      const canonical = normalizeIssuer(act.issuer);
      const key = `${act.issuer} → ${canonical}`;
      if (!changes.has(key)) changes.set(key, { from: act.issuer, to: canonical, ids: [] });
      changes.get(key)!.ids.push(act.id);
    } catch (e) {
      errors.push({ fullNumber: act.fullNumber, issuer: act.issuer, error: (e as Error).message });
    }
  }

  console.log(`📋 Mudanças propostas:`);
  for (const [key, info] of [...changes.entries()].sort()) {
    console.log(`   ${key}  (${info.ids.length} atos)`);
  }
  console.log(`\n   Inalterados (já canônicos): ${unchanged}`);
  if (errors.length) {
    console.log(`\n   ⚠️  Issuers desconhecidos (${errors.length}):`);
    for (const e of errors) console.log(`      ${e.fullNumber}: "${e.issuer}"`);
  }

  if (!apply) {
    console.log(`\n🔒 dry-run — use --apply pra escrever no DB`);
    await prisma.$disconnect();
    return;
  }

  if (errors.length) {
    console.log(`\n❌ Não vou aplicar enquanto houver issuers desconhecidos. Resolva primeiro.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`\n💾 Aplicando UPDATE...`);
  let totalUpdated = 0;
  for (const [, info] of changes.entries()) {
    const result = await prisma.legislativeAct.updateMany({
      where: { id: { in: info.ids } },
      data: { issuer: info.to },
    });
    console.log(`   ${info.from} → ${info.to}: ${result.count} atos`);
    totalUpdated += result.count;
  }
  console.log(`\n✅ ${totalUpdated} atos normalizados.`);

  console.log(`\n🧹 Invalidando cache Redis...`);
  await CacheInvalidation.legislativeActs();
  console.log(`   ✅ Cache invalidado`);

  // Sumário final
  const final = await prisma.legislativeAct.groupBy({
    by: ['issuer'],
    _count: { _all: true },
    orderBy: { _count: { issuer: 'desc' } },
  });
  console.log(`\n📊 Estado final:`);
  let total = 0;
  for (const g of final) {
    console.log(`   ${g.issuer.padEnd(28)} ${g._count._all}`);
    total += g._count._all;
  }
  console.log(`   ${'TOTAL'.padEnd(28)} ${total}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
