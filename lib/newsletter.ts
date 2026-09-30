/**
 * Newsletter Subscribers Data Fetching (Fase 7)
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';
import {
  CONFIRMED_SUBSCRIBER_WHERE,
  PENDING_SUBSCRIBER_WHERE,
  subscriberStatus,
} from './newsletter/filters';

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string | null;
  status: string;
  subscribedAt: Date;
  unsubscribedAt: Date | null;
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

  // Mapeia status (UI) → colunas do schema. Double opt-in:
  // - active:       isActive + confirmedAt preenchido (recebe os envios)
  // - pending:      isActive sem confirmedAt (aguarda o clique no link)
  // - unsubscribed: isActive = false
  if (params.status === 'active') Object.assign(where, CONFIRMED_SUBSCRIBER_WHERE);
  else if (params.status === 'pending') Object.assign(where, PENDING_SUBSCRIBER_WHERE);
  else if (params.status === 'unsubscribed') where.isActive = false;

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

  // Deriva campo "status" textual pra UI exibir
  const itemsWithStatus = subscribers.map((s) => ({
    ...s,
    status: subscriberStatus(s),
  }));

  return {
    items: itemsWithStatus as unknown as NewsletterSubscriber[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
