/**
 * Blog Posts Data Fetching (Fase 7 - Server Components)
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: Date;
  isPublished: boolean;
  tags: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Busca posts do blog com paginação (server-side)
 */
export async function fetchBlogPostsPaginated(params: {
  page?: string;
  pageSize?: string;
  isPublished?: string;
  search?: string;
}): Promise<PaginatedResult<BlogPost>> {
  // Parse pagination
  const page = parseInt(params.page || '1');
  const pageSize = parseInt(params.pageSize || '10');
  const skip = (page - 1) * pageSize;

  // Build where clause
  const where: Record<string, unknown> = {};

  // Filtro de status
  if (params.isPublished !== undefined && params.isPublished !== '') {
    where.isPublished = params.isPublished === 'true';
  }

  // Busca por título
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { excerpt: { contains: params.search, mode: 'insensitive' } },
      { author: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  // Buscar total e posts em paralelo
  const [total, posts] = await Promise.all([
    prisma.blogPost.count({ where }),
    prisma.blogPost.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        publishedAt: 'desc',
      },
    }),
  ]);

  return {
    items: posts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Deletar post do blog
 */
export async function deleteBlogPost(id: string): Promise<void> {
  await prisma.blogPost.delete({
    where: { id },
  });
}
