/**
 * Legislative Acts Data Fetching (Fase 7 - Server Components)
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';

export interface LegislativeAct {
  id: string;
  type: string;
  number: string;
  year: number;
  fullNumber: string;
  title: string;
  ementa: string;
  summary: string | null;
  issuer: string;
  publishDate: Date;
  effectiveDate: Date | null;
  hierarchyLevel: number;
  leiArticles: string | null;
  officialUrl: string | null;
  pdfUrl: string | null;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Busca atos normativos com paginação (server-side)
 */
export async function fetchLegislativeActsPaginated(params: {
  page?: string;
  pageSize?: string;
  type?: string;
  issuer?: string;
  year?: string;
  search?: string;
}): Promise<PaginatedResult<LegislativeAct>> {
  // Parse pagination
  const page = parseInt(params.page || '1');
  const pageSize = parseInt(params.pageSize || '20');
  const skip = (page - 1) * pageSize;

  // Build where clause
  const where: Record<string, unknown> = {};

  // Filtro de tipo
  if (params.type && params.type !== '') {
    where.type = params.type;
  }

  // Filtro de emissor
  if (params.issuer && params.issuer !== '') {
    where.issuer = params.issuer;
  }

  // Filtro de ano
  if (params.year && params.year !== '') {
    where.year = parseInt(params.year);
  }

  // Busca por título/ementa
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { ementa: { contains: params.search, mode: 'insensitive' } },
      { fullNumber: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  // Buscar total e atos em paralelo
  const [total, acts] = await Promise.all([
    prisma.legislativeAct.count({ where }),
    prisma.legislativeAct.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [
        { year: 'desc' },
        { number: 'desc' },
      ],
    }),
  ]);

  return {
    items: acts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Deletar ato normativo
 */
export async function deleteLegislativeAct(id: string): Promise<void> {
  await prisma.legislativeAct.delete({
    where: { id },
  });
}

/**
 * Obter tipos únicos
 */
export async function getLegislativeActTypes(): Promise<string[]> {
  const types = await prisma.legislativeAct.findMany({
    select: { type: true },
    distinct: ['type'],
    orderBy: { type: 'asc' },
  });

  return types.map(t => t.type);
}

/**
 * Obter emissores únicos
 */
export async function getLegislativeActIssuers(): Promise<string[]> {
  const issuers = await prisma.legislativeAct.findMany({
    select: { issuer: true },
    distinct: ['issuer'],
    orderBy: { issuer: 'asc' },
  });

  return issuers.map(i => i.issuer);
}

/**
 * Obter anos únicos
 */
export async function getLegislativeActYears(): Promise<number[]> {
  const years = await prisma.legislativeAct.findMany({
    select: { year: true },
    distinct: ['year'],
    orderBy: { year: 'desc' },
  });

  return years.map(y => y.year);
}

/**
 * Estatísticas agregadas dos atos normativos
 */
export interface LegislativeActStats {
  total: number;
  withPdf: number;
  withOfficialUrl: number;
  totalViews: number;
}

/**
 * Buscar estatísticas agregadas de todos os atos normativos
 */
export async function getLegislativeActStats(): Promise<LegislativeActStats> {
  const [total, withPdf, withOfficialUrl, viewsResult] = await Promise.all([
    prisma.legislativeAct.count(),
    prisma.legislativeAct.count({ where: { pdfUrl: { not: null } } }),
    prisma.legislativeAct.count({ where: { officialUrl: { not: null } } }),
    prisma.legislativeAct.aggregate({ _sum: { viewCount: true } }),
  ]);

  return {
    total,
    withPdf,
    withOfficialUrl,
    totalViews: viewsResult._sum.viewCount || 0,
  };
}
