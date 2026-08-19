/**
 * Retira de circulação os registros do STJ vindos do DataJud.
 *
 * NÃO apaga nada — regra permanente do projeto. Marca como auto_rejected,
 * o que os remove da listagem pública e da busca, preservando o histórico.
 *
 *   npx tsx --env-file=.env.local scripts/aposentar-datajud-stj.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/aposentar-datajud-stj.ts
 */
import { prisma } from '@/lib/prisma';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const alvo = {
    tribunalCode: 'STJ',
    sourceApi: { startsWith: 'datajud-' },
    approvalStatus: { not: 'auto_rejected' },
  } as const;

  const total = await prisma.tribunalDecision.count({ where: alvo });
  console.log(`registros do DataJud a marcar: ${total}`);

  if (dryRun) {
    console.log('(dry-run — nada foi escrito)');
    await prisma.$disconnect();
    return;
  }

  const r = await prisma.tribunalDecision.updateMany({
    where: alvo,
    data: {
      approvalStatus: 'auto_rejected',
      isRelevant: false,
      classificationReasoning:
        'Aposentado em 18/08/2026: fonte DataJud entrega capa processual, sem ementa. Substituído pelos Espelhos de Acórdãos do STJ.',
    },
  });

  console.log(`marcados: ${r.count}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
