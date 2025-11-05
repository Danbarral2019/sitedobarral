'use server';

/**
 * Publications Data Fetching (Fase 7 - Server Components)
 * Server Actions para operações de admin
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';
import { isAdmin } from './auth';
import { revalidatePath } from 'next/cache';

export interface Publication {
  id: string;
  type: string;
  title: string;
  description: string;
  author: string;
  publishedAt: Date;
  isPublished: boolean;
  publisher?: string | null;
  journal?: string | null;
  eventDate?: Date | null;
  location?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Busca publicações com paginação (server-side)
 */
export async function fetchPublicationsPaginated(params: {
  page?: string;
  pageSize?: string;
  type?: string;
  isPublished?: string;
  search?: string;
}): Promise<PaginatedResult<Publication>> {
  // Parse pagination
  const page = parseInt(params.page || '1');
  const pageSize = parseInt(params.pageSize || '10');
  const skip = (page - 1) * pageSize;

  // Build where clause
  const where: Record<string, unknown> = {};

  // Filtro de tipo
  if (params.type !== undefined && params.type !== '' && params.type !== 'all') {
    where.type = params.type;
  }

  // Filtro de status
  if (params.isPublished !== undefined && params.isPublished !== '') {
    where.isPublished = params.isPublished === 'true';
  }

  // Busca por título/autor
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
      { author: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  // Buscar total e publicações em paralelo
  const [total, publications] = await Promise.all([
    prisma.publication.count({ where }),
    prisma.publication.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        publishedAt: 'desc',
      },
    }),
  ]);

  return {
    items: publications,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Deletar publicação (Server Action)
 * Requer autenticação de admin
 */
export async function deletePublication(id: string): Promise<{ error?: string }> {
  try {
    // Verificação de autenticação/autorização
    const userIsAdmin = await isAdmin();
    if (!userIsAdmin) {
      return { error: 'Não autorizado. Apenas administradores podem deletar publicações.' };
    }

    // Validação de input
    if (!id || typeof id !== 'string') {
      return { error: 'ID inválido.' };
    }

    // Deletar publicação
    await prisma.publication.delete({
      where: { id },
    });

    // Revalidar cache
    revalidatePath('/admin/publicacoes');
    revalidatePath('/publicacoes');

    return {};
  } catch (error) {
    console.error('Erro ao deletar publicação:', error);
    return { error: 'Não foi possível deletar a publicação. Tente novamente.' };
  }
}
