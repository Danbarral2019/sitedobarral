/**
 * Helpers de query pra FAQ.
 *
 * Centraliza lógica compartilhada entre rotas pública e admin pra evitar
 * duplicação de filtros/ordering.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export interface FAQListItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  isPinned: boolean;
  displayOrder: number;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FAQAdminItem extends FAQListItem {
  isPublished: boolean;
  keywords: string | null;
  relatedFAQs: string | null;
  relatedDocs: string | null;
}

export interface FAQByCategory {
  category: string;
  items: FAQListItem[];
}

/**
 * Lista pública: agrupa por categoria, ordenada por isPinned + displayOrder.
 * Filtros opcionais: categoria específica, search term (LIKE em question/answer).
 */
export async function listPublishedFAQs(opts: { category?: string; search?: string } = {}): Promise<FAQByCategory[]> {
  const where: Prisma.FAQWhereInput = { isPublished: true };
  if (opts.category) where.category = opts.category;
  if (opts.search && opts.search.trim()) {
    where.OR = [
      { question: { contains: opts.search, mode: 'insensitive' } },
      { answer: { contains: opts.search, mode: 'insensitive' } },
      { keywords: { contains: opts.search, mode: 'insensitive' } },
    ];
  }

  const items = await prisma.fAQ.findMany({
    where,
    orderBy: [{ isPinned: 'desc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
  });

  // Agrupa por categoria preservando ordem de aparecimento
  const map = new Map<string, FAQListItem[]>();
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, []);
    map.get(item.category)!.push(item);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}

/**
 * Lista admin: TODAS as FAQs (incluindo unpublished). Sem agrupamento.
 */
export async function listAllFAQs(): Promise<FAQAdminItem[]> {
  return prisma.fAQ.findMany({
    orderBy: [{ category: 'asc' }, { isPinned: 'desc' }, { displayOrder: 'asc' }],
  });
}

export async function getFAQById(id: string) {
  return prisma.fAQ.findUnique({ where: { id } });
}

export async function incrementFAQViewCount(id: string): Promise<void> {
  await prisma.fAQ.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
  });
}
