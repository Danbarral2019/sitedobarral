'use server';

/**
 * Recommended Sites Data Fetching (Fase 7 - Server Components)
 * Server Actions para operações de admin
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';
import { isAdmin } from './auth';
import { revalidatePath } from 'next/cache';

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

/**
 * Deletar site recomendado (Server Action)
 * Requer autenticação de admin
 */
export async function deleteSite(id: string): Promise<{ error?: string }> {
  try {
    // Verificação de autenticação/autorização
    const userIsAdmin = await isAdmin();
    if (!userIsAdmin) {
      return { error: 'Não autorizado. Apenas administradores podem deletar sites.' };
    }

    // Validação de input
    if (!id || typeof id !== 'string') {
      return { error: 'ID inválido.' };
    }

    // Deletar site
    await prisma.recommendedSite.delete({ where: { id } });

    // Revalidar cache
    revalidatePath('/admin/sites');

    return {};
  } catch (error) {
    console.error('Erro ao deletar site recomendado:', error);
    return { error: 'Não foi possível deletar o site. Tente novamente.' };
  }
}
