/**
 * Contact Forms Data Fetching (Fase 7)
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';

export interface ContactForm {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  phone: string | null;
  status: string;
  createdAt: Date;
}

export async function fetchContactFormsPaginated(params: {
  page?: string;
  pageSize?: string;
  status?: string;
  search?: string;
}): Promise<PaginatedResult<ContactForm>> {
  const page = parseInt(params.page || '1');
  const pageSize = parseInt(params.pageSize || '20');
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (params.status && params.status !== 'all') {
    where.status = params.status;
  }

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
      { subject: { contains: params.search, mode: 'insensitive' } },
      { message: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [total, contacts] = await Promise.all([
    prisma.contactForm.count({ where }),
    prisma.contactForm.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    items: contacts as unknown as ContactForm[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function deleteContactForm(id: string): Promise<void> {
  await prisma.contactForm.delete({ where: { id } });
}
