import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';

/**
 * GET: Retorna estatisticas de documentos AGU no banco
 * - Contagem por tipo (ON, Sumula, Parecer Vinculante, DECOR)
 * - Data da ultima importacao
 */
export const GET = withAdminApi(async (_request: NextRequest) => {
  const aguCategories = [
    'orientacao-normativa',
    'sumula',
    'parecer-vinculante',
    'decor',
    'enunciado',
  ];

  // Contagem por categoria (distinct por URL para evitar duplicatas multi-curso)
  const counts = await Promise.all(
    aguCategories.map(async (category) => {
      const total = await prisma.document.findMany({
        where: { category },
        select: { url: true },
        distinct: ['url'],
      });
      return { category, count: total.length };
    })
  );

  // Ultimo documento AGU importado
  const lastImported = await prisma.document.findFirst({
    where: {
      category: { in: aguCategories },
    },
    orderBy: { uploadedAt: 'desc' },
    select: {
      uploadedAt: true,
      category: true,
      title: true,
    },
  });

  const categoryLabels: Record<string, string> = {
    'orientacao-normativa': 'Orientacoes Normativas',
    'sumula': 'Sumulas AGU',
    'parecer-vinculante': 'Pareceres Vinculantes',
    'decor': 'Pareceres DECOR',
    'enunciado': 'Enunciados',
  };

  return NextResponse.json({
    counts: counts.map(c => ({
      category: c.category,
      label: categoryLabels[c.category] || c.category,
      count: c.count,
    })),
    totalDocuments: counts.reduce((sum, c) => sum + c.count, 0),
    lastImport: lastImported
      ? {
          date: lastImported.uploadedAt,
          category: lastImported.category,
          title: lastImported.title,
        }
      : null,
  });
});
