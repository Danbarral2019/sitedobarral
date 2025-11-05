'use server';

/**
 * Glossary Terms Data Fetching (Fase 7 - Server Components)
 * Server Actions para operações de admin
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';
import { isAdmin } from './auth';
import { revalidatePath } from 'next/cache';

export interface GlossaryTerm {
  id: string;
  term: string;
  slug: string;
  shortDef?: string | null;
  definition: string;
  category?: string | null;
  externalUrl?: string | null;
  isPublic: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Busca termos do glossário com paginação (server-side)
 */
export async function fetchGlossaryTermsPaginated(params: {
  page?: string;
  pageSize?: string;
  category?: string;
  isPublic?: string;
  search?: string;
}): Promise<PaginatedResult<GlossaryTerm>> {
  // Parse pagination
  const page = parseInt(params.page || '1');
  const pageSize = parseInt(params.pageSize || '10');
  const skip = (page - 1) * pageSize;

  // Build where clause
  const where: Record<string, unknown> = {};

  // Filtro de categoria
  if (params.category && params.category !== 'all' && params.category !== '') {
    where.category = params.category;
  }

  // Filtro de status
  if (params.isPublic !== undefined && params.isPublic !== '') {
    where.isPublic = params.isPublic === 'true';
  }

  // Busca por termo/definição
  if (params.search) {
    where.OR = [
      { term: { contains: params.search, mode: 'insensitive' } },
      { definition: { contains: params.search, mode: 'insensitive' } },
      { shortDef: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  // Buscar total e termos em paralelo
  const [total, terms] = await Promise.all([
    prisma.glossaryTerm.count({ where }),
    prisma.glossaryTerm.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        term: 'asc',
      },
    }),
  ]);

  return {
    items: terms,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Deletar termo do glossário (Server Action)
 * Requer autenticação de admin
 */
export async function deleteGlossaryTerm(id: string): Promise<{ error?: string }> {
  try {
    // Verificação de autenticação/autorização
    const userIsAdmin = await isAdmin();
    if (!userIsAdmin) {
      return { error: 'Não autorizado. Apenas administradores podem deletar termos.' };
    }

    // Validação de input
    if (!id || typeof id !== 'string') {
      return { error: 'ID inválido.' };
    }

    // Deletar termo
    await prisma.glossaryTerm.delete({
      where: { id },
    });

    // Revalidar cache
    revalidatePath('/admin/glossario');
    revalidatePath('/glossario');

    return {};
  } catch (error) {
    console.error('Erro ao deletar termo do glossário:', error);
    return { error: 'Não foi possível deletar o termo. Tente novamente.' };
  }
}

/**
 * Toggle status público
 */
export async function toggleGlossaryTermPublic(id: string, currentStatus: boolean): Promise<void> {
  await prisma.glossaryTerm.update({
    where: { id },
    data: { isPublic: !currentStatus },
  });
}
