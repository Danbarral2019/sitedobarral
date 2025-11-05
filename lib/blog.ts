'use server';

/**
 * Blog Posts Data Fetching (Fase 7 - Server Components)
 * Server Actions para operações de admin
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';
import { isAdmin } from './auth';
import { revalidatePath } from 'next/cache';

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
 * Deletar post do blog (Server Action)
 * Requer autenticação de admin
 */
export async function deleteBlogPost(id: string): Promise<{ error?: string }> {
  try {
    // Verificação de autenticação/autorização
    const userIsAdmin = await isAdmin();
    if (!userIsAdmin) {
      return { error: 'Não autorizado. Apenas administradores podem deletar posts.' };
    }

    // Validação de input
    if (!id || typeof id !== 'string') {
      return { error: 'ID inválido.' };
    }

    // Deletar post
    await prisma.blogPost.delete({
      where: { id },
    });

    // Revalidar cache para atualizar UI automaticamente
    revalidatePath('/admin/blog');
    revalidatePath('/blog');

    return {};
  } catch (error) {
    console.error('Erro ao deletar post do blog:', error);
    return { error: 'Não foi possível deletar o post. Tente novamente.' };
  }
}
