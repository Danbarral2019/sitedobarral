/**
 * Newsletter Subscribers Data Fetching (Fase 7)
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';

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

  // Mapeia status (UI) → isActive (schema). Não há "pending" no banco —
  // schema só tem isActive boolean. Anteriormente passava `where.status`
  // direto, que dava 500 porque a coluna não existe.
  if (params.status === 'active') where.isActive = true;
  else if (params.status === 'unsubscribed') where.isActive = false;
  else if (params.status === 'pending') {
    // Sem coluna pending — força resultado vazio em vez de 500
    where.id = '__pending_not_supported__';
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

  // Deriva campo "status" textual a partir de isActive pra UI exibir
  const itemsWithStatus = subscribers.map((s) => ({
    ...s,
    status: s.isActive ? 'active' : 'unsubscribed',
  }));

  return {
    items: itemsWithStatus as unknown as NewsletterSubscriber[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function deleteNewsletterSubscriber(id: string): Promise<void> {
  await prisma.newsletterSubscriber.delete({ where: { id } });
}
