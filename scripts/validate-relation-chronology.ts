/**
 * Validação cronológica das relações entre atos normativos.
 *
 * Detecta `LegislativeActRelation` onde target.publishDate > source.publishDate
 * para `relationType ∈ {revoga, altera}`. Logicamente impossível: um ato de 2024
 * não pode revogar/alterar um ato de 2025.
 *
 * Caso conhecido: Decreto 12.343/2024 → revoga → Decreto 12.807/2025.
 *
 * Por padrão é dry-run (lista candidatos). Com `--apply`, marca
 * `reviewStatus='rejected'`, `confirmedBy='cronologia-auto'`, `confirmedAt=now`.
 *
 * Não toca em `regulamenta`/`complementa`/`modifica` — só os 2 verbos onde a
 * incompatibilidade cronológica é taxativa.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/validate-relation-chronology.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/validate-relation-chronology.ts --apply
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

const FORBIDDEN_TYPES = new Set(['revoga', 'altera']);

async function main() {
  console.log(`\n=== Validação cronológica de relações ${APPLY ? '[APPLY]' : '[DRY-RUN]'} ===\n`);

  // Só consideramos pending (não re-rejeitar nada já confirmado pelo admin)
  const relations = await prisma.legislativeActRelation.findMany({
    where: {
      reviewStatus: 'pending',
      relationType: { in: Array.from(FORBIDDEN_TYPES) },
    },
    include: {
      sourceAct: { select: { fullNumber: true, publishDate: true } },
      targetAct: { select: { fullNumber: true, publishDate: true } },
    },
  });

  console.log(`Pendentes com tipo {revoga, altera}: ${relations.length}\n`);

  const violations: typeof relations = [];
  for (const r of relations) {
    if (r.targetAct.publishDate.getTime() > r.sourceAct.publishDate.getTime()) {
      violations.push(r);
    }
  }

  if (violations.length === 0) {
    console.log('✅ Nenhuma violação cronológica encontrada.');
    await prisma.$disconnect();
    return;
  }

  console.log(`⚠️  ${violations.length} violação(ões) cronológica(s):\n`);
  for (const v of violations) {
    const srcYear = v.sourceAct.publishDate.getFullYear();
    const tgtYear = v.targetAct.publishDate.getFullYear();
    console.log(
      `  ${v.sourceAct.fullNumber} (${srcYear}) → ${v.relationType} → ${v.targetAct.fullNumber} (${tgtYear})`,
    );
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Rode com --apply para marcar essas ${violations.length} como reviewStatus='rejected'.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\nMarcando ${violations.length} como rejected...`);
  const ids = violations.map((v) => v.id);
  const result = await prisma.legislativeActRelation.updateMany({
    where: { id: { in: ids } },
    data: {
      reviewStatus: 'rejected',
      confirmedBy: 'cronologia-auto',
      confirmedAt: new Date(),
    },
  });
  console.log(`✅ ${result.count} relação(ões) rejeitada(s).`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
