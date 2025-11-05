/**
 * Recommended Sites Data Fetching (Fase 7 - Server Components)
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';

export interface RecommendedSite {
  id: string;
  title: string;
  description: string;
  url: string;
  faviconUrl: string | null;
  category: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Busca sites recomendados com paginação
 */
export async function fetchSitesPaginated(params: {
  page?: string;
  pageSize?: string;
  category?: string;
  isActive?: string;
  search?: string;
}): Promise<PaginatedResult<RecommendedSite>> {
  const page = parseInt(params.page || '1');
  const pageSize = parseInt(params.pageSize || '50');
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (params.category && params.category !== 'all') {
    where.category = params.category;
  }

  if (params.isActive !== undefined && params.isActive !== '') {
    where.isActive = params.isActive === 'true';
  }

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
      { url: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [total, sites] = await Promise.all([
    prisma.recommendedSite.count({ where }),
    prisma.recommendedSite.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { displayOrder: 'asc' },
    }),
  ]);

  return {
    items: sites,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function deleteSite(id: string): Promise<void> {
  await prisma.recommendedSite.delete({ where: { id } });
}
