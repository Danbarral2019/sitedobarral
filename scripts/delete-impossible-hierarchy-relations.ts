/**
 * Deleta (não rejeita) relações hierarquicamente impossíveis.
 *
 * Daniel reforçou em 2026-05-13: decretos nunca alteram leis, portarias
 * nunca alteram leis/decretos, etc. Isso não existe juridicamente — o
 * detector heurístico produz essas detecções por confundir verbos no
 * texto. Antes ficavam como reviewStatus='rejected' (mantém histórico);
 * agora deletamos porque não há valor em manter o histórico de algo
 * juridicamente impossível.
 *
 * Critério: relationType ∈ {revoga, altera} E source.hierarchyLevel >
 * target.hierarchyLevel (source mais fraco que target).
 *
 * Inclui tanto pending quanto rejected — qualquer estado dessas
 * detecções pode ser deletado.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/delete-impossible-hierarchy-relations.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/delete-impossible-hierarchy-relations.ts --apply
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

const TYPES_TO_CHECK = new Set(['revoga', 'altera']);

async function main() {
  console.log(`\n=== Delete relações impossíveis ${APPLY ? '[APPLY]' : '[DRY-RUN]'} ===\n`);

  // Pega TODAS (pending + confirmed + rejected) com tipo revoga/altera
  const relations = await prisma.legislativeActRelation.findMany({
    where: { relationType: { in: Array.from(TYPES_TO_CHECK) } },
    include: {
      sourceAct: { select: { fullNumber: true, hierarchyLevel: true } },
      targetAct: { select: { fullNumber: true, hierarchyLevel: true } },
    },
  });

  // Filtra pelas hierarquicamente impossíveis
  const impossible = relations.filter(
    (r) => r.sourceAct.hierarchyLevel > r.targetAct.hierarchyLevel,
  );

  // Distribuição por status pra reportar
  const byStatus = new Map<string, number>();
  for (const r of impossible) byStatus.set(r.reviewStatus, (byStatus.get(r.reviewStatus) ?? 0) + 1);

  console.log(`Relações revoga/altera totais: ${relations.length}`);
  console.log(`Impossíveis (source mais fraco que target): ${impossible.length}`);
  console.log('  Distribuição por status:');
  for (const [s, n] of byStatus) console.log(`    ${s}: ${n}`);

  if (impossible.length === 0) {
    console.log('\n✅ Nenhuma relação impossível encontrada.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nLista completa:');
  for (const v of impossible) {
    const srcLbl = getHierarchyLabel(v.sourceAct.hierarchyLevel);
    const tgtLbl = getHierarchyLabel(v.targetAct.hierarchyLevel);
    console.log(
      `  [${v.reviewStatus}] ${v.sourceAct.fullNumber} [${srcLbl}] → ${v.relationType} → ${v.targetAct.fullNumber} [${tgtLbl}]`,
    );
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Rode com --apply para DELETAR essas ${impossible.length} relações (não há recuperação).`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\nDeletando ${impossible.length} relações...`);
  const ids = impossible.map((v) => v.id);
  const result = await prisma.legislativeActRelation.deleteMany({
    where: { id: { in: ids } },
  });
  console.log(`✅ ${result.count} relação(ões) deletada(s).`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
