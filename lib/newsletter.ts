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
    items: subscribers as unknown as NewsletterSubscriber[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function deleteNewsletterSubscriber(id: string): Promise<void> {
  await prisma.newsletterSubscriber.delete({ where: { id } });
}
