'use server';

/**
 * Testimonials Data Fetching (Fase 7)
 * Server Actions para operações de admin
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';
import { isAdmin } from './auth';
import { revalidatePath } from 'next/cache';

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string | null;
  content: string;
  rating: number;
  photoUrl: string | null;
  isPublished: boolean;
  displayOrder: number;
  createdAt: Date;
}

export async function fetchTestimonialsPaginated(params: {
  page?: string;
  pageSize?: string;
  isPublished?: string;
  search?: string;
}): Promise<PaginatedResult<Testimonial>> {
  const page = parseInt(params.page || '1');
  const pageSize = parseInt(params.pageSize || '20');
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (params.isPublished !== undefined && params.isPublished !== '') {
    where.isPublished = params.isPublished === 'true';
  }

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { role: { contains: params.search, mode: 'insensitive' } },
      { content: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [total, testimonials] = await Promise.all([
    prisma.testimonial.count({ where }),
    prisma.testimonial.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { displayOrder: 'asc' },
    }),
  ]);

  return {
    items: testimonials,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Deletar depoimento (Server Action)
 * Requer autenticação de admin
 */
export async function deleteTestimonial(id: string): Promise<{ error?: string }> {
  try {
    // Verificação de autenticação/autorização
    const userIsAdmin = await isAdmin();
    if (!userIsAdmin) {
      return { error: 'Não autorizado. Apenas administradores podem deletar depoimentos.' };
    }

    // Validação de input
    if (!id || typeof id !== 'string') {
      return { error: 'ID inválido.' };
    }

    // Deletar depoimento
    await prisma.testimonial.delete({ where: { id } });

    // Revalidar cache
    revalidatePath('/admin/depoimentos');
    revalidatePath('/');

    return {};
  } catch (error) {
    console.error('Erro ao deletar depoimento:', error);
    return { error: 'Não foi possível deletar o depoimento. Tente novamente.' };
  }
}
