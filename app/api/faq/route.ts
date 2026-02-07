import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';
import { handleApiError } from '@/lib/errors/error-handler';

import { Prisma } from '@prisma/client';

// GET /api/faq - Listar todas as FAQs publicadas
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');

    // Generate cache key based on category filter
    const cacheKey = CacheKeys.faqList(category);

    // Use cached result or fetch from database
    const result = await withCache(
      cacheKey,
      async () => {
        // Construir filtros
        const where: Prisma.FAQWhereInput = {
          isPublished: true,
        };

        if (category) {
          where.category = category;
        }

        // Buscar FAQs
        const faqs = await prisma.fAQ.findMany({
          where,
          select: {
            id: true,
            question: true,
            answer: true,
            category: true,
            isPinned: true,
            viewCount: true,
            helpfulCount: true,
            notHelpfulCount: true,
          },
          orderBy: [
            // Perguntas fixadas primeiro
            { isPinned: 'desc' },
            // Depois por ordem de exibição
            { displayOrder: 'asc' },
            // Por fim, por data de criação
            { createdAt: 'desc' },
          ],
        });

        // Extrair categorias: se filtrado por categoria, precisamos buscar todas;
        // se sem filtro, extraímos do resultado já obtido (evita query adicional)
        const categories = category
          ? [...new Set((await prisma.fAQ.findMany({
              where: { isPublished: true },
              select: { category: true },
            })).map((f) => f.category))].sort()
          : [...new Set(faqs.map((f) => f.category))].sort();

        return {
          faqs,
          total: faqs.length,
          categories,
        };
      },
      CACHE_TTL.FAQ_LIST,
      { prefix: 'faq' }
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
