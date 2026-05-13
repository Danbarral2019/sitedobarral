/**
 * Validação hierárquica das relações entre atos normativos.
 *
 * Regra: um ato só pode revogar/alterar outro de hierarquia igual ou inferior.
 * Hierarquia (menor número = nível mais alto):
 *   1=Lei · 2=Decreto · 3=Portaria · 4=IN · 5=Ordem de Serviço
 *
 * Violação: `source.hierarchyLevel > target.hierarchyLevel` para
 * `relationType ∈ {revoga, altera}` — significa source está ABAIXO do target
 * na pirâmide. Ex: Decreto(2) "revoga" Lei(1) → impossível.
 *
 * Por ora não valida `regulamenta` (regra inversa, mais nuances) nem `complementa`
 * (semântica frouxa, fácil falso positivo) nem `modifica` (fallback genérico).
 *
 * Por padrão é dry-run. Com `--apply`, marca `reviewStatus='rejected'`,
 * `confirmedBy='hierarquia-auto'`, `confirmedAt=now`.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/validate-relation-hierarchy.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/validate-relation-hierarchy.ts --apply
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { getHierarchyLabel } from '../lib/legislative-acts/hierarchy';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

const FORBIDDEN_TYPES = new Set(['revoga', 'altera']);

async function main() {
  console.log(`\n=== Validação hierárquica de relações ${APPLY ? '[APPLY]' : '[DRY-RUN]'} ===\n`);

  const relations = await prisma.legislativeActRelation.findMany({
    where: {
      reviewStatus: 'pending',
      relationType: { in: Array.from(FORBIDDEN_TYPES) },
    },
    include: {
      sourceAct: { select: { fullNumber: true, hierarchyLevel: true } },
      targetAct: { select: { fullNumber: true, hierarchyLevel: true } },
    },
  });

  console.log(`Pendentes com tipo {revoga, altera}: ${relations.length}\n`);

  const violations = relations.filter(
    (r) => r.sourceAct.hierarchyLevel > r.targetAct.hierarchyLevel,
  );

  if (violations.length === 0) {
    console.log('✅ Nenhuma violação hierárquica encontrada.');
    await prisma.$disconnect();
    return;
  }

  console.log(`⚠️  ${violations.length} violação(ões) hierárquica(s):\n`);
  for (const v of violations) {
    const srcLbl = getHierarchyLabel(v.sourceAct.hierarchyLevel);
    const tgtLbl = getHierarchyLabel(v.targetAct.hierarchyLevel);
    console.log(
      `  ${v.sourceAct.fullNumber} [${srcLbl}] → ${v.relationType} → ${v.targetAct.fullNumber} [${tgtLbl}]`,
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
      confirmedBy: 'hierarquia-auto',
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
