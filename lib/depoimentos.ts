/**
 * Testimonials Data Fetching (Fase 7)
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';

export interface Testimonial {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  text: string;
  rating: number;
  avatar: string;
  color: string;
  status: string;
  moderatedBy: string | null;
  moderatedAt: Date | string | null;
  rejectionReason: string | null;
  createdAt: Date | string;
}

export async function fetchTestimonialsPaginated(params: {
  page?: string;
  pageSize?: string;
  status?: string;
  search?: string;
}): Promise<PaginatedResult<Testimonial>> {
  const page = parseInt(params.page || '1');
  const pageSize = parseInt(params.pageSize || '20');
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (params.status !== undefined && params.status !== '') {
    where.status = params.status;
  }

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { role: { contains: params.search, mode: 'insensitive' } },
      { text: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [total, testimonials] = await Promise.all([
    prisma.testimonial.count({ where }),
    prisma.testimonial.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    items: testimonials as unknown as Testimonial[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function deleteTestimonial(id: string): Promise<void> {
  await prisma.testimonial.delete({ where: { id } });
}
