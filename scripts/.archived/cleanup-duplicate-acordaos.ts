/**
 * Script: Limpar acórdãos TCU duplicados
 *
 * Para cada grupo (mesmo número/ano), mantém o melhor registro (score-based)
 * e remove os excedentes com seus chunks de embedding.
 *
 * Uso: npx dotenv -e .env.local -- npx tsx scripts/cleanup-duplicate-acordaos.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Encontrar todos os grupos duplicados
  const dupeGroups: Array<{ acordaoNumero: number; acordaoAno: number }> = await prisma.$queryRaw`
    SELECT "acordaoNumero", "acordaoAno"
    FROM "Document"
    WHERE category = 'acordao' AND "acordaoNumero" IS NOT NULL
    GROUP BY "acordaoNumero", "acordaoAno"
    HAVING COUNT(*) > 1
  `;

  console.log('Grupos duplicados encontrados:', dupeGroups.length);

  let totalRemoved = 0;

  for (const group of dupeGroups) {
    const docs = await prisma.document.findMany({
      where: {
        category: 'acordao',
        acordaoNumero: group.acordaoNumero,
        acordaoAno: group.acordaoAno,
      },
      select: {
        id: true,
        isCommon: true,
        summary: true,
        embeddingStatus: true,
        leiArticles: true, leiArticlesArr: true,
        uploadedAt: true,
        metaTcu: {
          select: {
            ementaCompleta: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    // Scoring: escolher o melhor registro
    const scored = docs.map(d => {
      let score = 0;
      if (d.isCommon) score += 10;
      if (d.summary) score += 5;
      if (d.embeddingStatus === 'completed') score += 5;
      if (d.leiArticles) score += 3;
      if (d.metaTcu?.ementaCompleta) score += 2;
      return { ...d, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const keep = scored[0];
    const toRemove = scored.slice(1);

    // Se o melhor não é common, torná-lo common
    if (keep.isCommon === false) {
      await prisma.document.update({
        where: { id: keep.id },
        data: { isCommon: true, courseId: null },
      });
    }

    const removeIds = toRemove.map(d => d.id);

    // Deletar chunks de embedding dos duplicados
    await prisma.documentChunk.deleteMany({
      where: { documentId: { in: removeIds } },
    });

    // Deletar documentos duplicados
    await prisma.document.deleteMany({
      where: { id: { in: removeIds } },
    });

    totalRemoved += toRemove.length;
  }

  console.log(`[Cleanup] ${dupeGroups.length} grupos processados, ${totalRemoved} duplicatas removidas`);

  // Verificação final
  const finalCount = await prisma.document.count({ where: { category: 'acordao' } });
  console.log('Total final de acórdãos:', finalCount);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
