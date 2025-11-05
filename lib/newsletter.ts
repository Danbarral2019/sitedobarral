'use server';

/**
 * Newsletter Subscribers Data Fetching (Fase 7)
 * Server Actions para operações de admin
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';
import { isAdmin } from './auth';
import { revalidatePath } from 'next/cache';

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string | null;
  status: string;
  subscribedAt: Date;
  unsubscribedAt: Date | null;
  mailchimpId: string | null;
}

export async function fetchNewsletterSubscribersPaginated(params: {
  page?: string;
  pageSize?: string;
  status?: string;
  search?: string;
}): Promise<PaginatedResult<NewsletterSubscriber>> {
  const page = parseInt(params.page || '1');
  const pageSize = parseInt(params.pageSize || '20');
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (params.status && params.status !== 'all') {
    where.status = params.status;
  }

  if (params.search) {
    where.OR = [
      { email: { contains: params.search, mode: 'insensitive' } },
      { name: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [total, subscribers] = await Promise.all([
    prisma.newsletterSubscriber.count({ where }),
    prisma.newsletterSubscriber.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { subscribedAt: 'desc' },
    }),
  ]);

  return {
    items: subscribers,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Deletar inscrito da newsletter (Server Action)
 * Requer autenticação de admin
 */
export async function deleteNewsletterSubscriber(id: string): Promise<{ error?: string }> {
  try {
    // Verificação de autenticação/autorização
    const userIsAdmin = await isAdmin();
    if (!userIsAdmin) {
      return { error: 'Não autorizado. Apenas administradores podem deletar inscritos.' };
    }

    // Validação de input
    if (!id || typeof id !== 'string') {
      return { error: 'ID inválido.' };
    }

    // Deletar inscrito
    await prisma.newsletterSubscriber.delete({ where: { id } });

    // Revalidar cache
    revalidatePath('/admin/newsletter');

    return {};
  } catch (error) {
    console.error('Erro ao deletar inscrito da newsletter:', error);
    return { error: 'Não foi possível deletar o inscrito. Tente novamente.' };
  }
}
