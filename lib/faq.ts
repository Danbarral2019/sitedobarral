/**
 * FAQ Data Fetching (Fase 7 - Server Components)
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  displayOrder: number;
  isPublished: boolean;
  tags: string[];
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Busca FAQs com paginação (server-side)
 */
export async function fetchFAQsPaginated(params: {
  page?: string;
  pageSize?: string;
  category?: string;
  isPublished?: string;
  search?: string;
}): Promise<PaginatedResult<FAQ>> {
  // Parse pagination
  const page = parseInt(params.page || '1');
  const pageSize = parseInt(params.pageSize || '50'); // FAQ geralmente mostra todos
  const skip = (page - 1) * pageSize;

  // Build where clause
  const where: Record<string, unknown> = {};

  // Filtro de categoria
  if (params.category && params.category !== 'all') {
    where.category = params.category;
  }

  // Filtro de status
  if (params.isPublished !== undefined && params.isPublished !== '') {
    where.isPublished = params.isPublished === 'true';
  }

  // Busca por pergunta/resposta
  if (params.search) {
    where.OR = [
      { question: { contains: params.search, mode: 'insensitive' } },
      { answer: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  // Buscar total e FAQs em paralelo
  const [total, faqs] = await Promise.all([
    prisma.fAQ.count({ where }),
    prisma.fAQ.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        displayOrder: 'asc',
      },
    }),
  ]);

  return {
    items: faqs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Deletar FAQ
 */
export async function deleteFAQ(id: string): Promise<void> {
  await prisma.fAQ.delete({
    where: { id },
  });
}

/**
 * Toggle publish status
 */
export async function toggleFAQPublish(id: string, currentStatus: boolean): Promise<void> {
  await prisma.fAQ.update({
    where: { id },
    data: { isPublished: !currentStatus },
  });
}

/**
 * Obter categorias únicas
 */
export async function getFAQCategories(): Promise<string[]> {
  const categories = await prisma.fAQ.findMany({
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });

  return categories.map(c => c.category);
}

/**
 * Obter stats gerais
 */
export async function getFAQStats() {
  const [total, published, totalViews, totalHelpful] = await Promise.all([
    prisma.fAQ.count(),
    prisma.fAQ.count({ where: { isPublished: true } }),
    prisma.fAQ.aggregate({
      _sum: { viewCount: true },
    }),
    prisma.fAQ.aggregate({
      _sum: { helpfulCount: true },
    }),
  ]);

  return {
    total,
    published,
    totalViews: totalViews._sum.viewCount || 0,
    totalHelpful: totalHelpful._sum.helpfulCount || 0,
  };
}
