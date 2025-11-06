/**
 * Testimonials Data Fetching (Fase 7)
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string | null;
  content: string;
  rating: number;
  photoUrl: string | null;
  isPublished: boolean;
  createdAt: Date | string;
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
      orderBy: { createdAt: 'desc' },
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

export async function deleteTestimonial(id: string): Promise<void> {
  await prisma.testimonial.delete({ where: { id } });
}
