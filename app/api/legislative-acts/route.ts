import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';

/**
 * GET /api/legislative-acts
 * API pública para listar atos normativos
 * Suporta filtros e busca
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parâmetros de filtro
    const type = searchParams.get('type'); // decreto, portaria, in, etc.
    const issuer = searchParams.get('issuer'); // Presidência, SEGES, MGI, etc.
    const year = searchParams.get('year');
    const search = searchParams.get('search'); // Busca por título/ementa
    const articleNumber = searchParams.get('article'); // Filtrar por artigo da Lei 14.133

    // Parâmetros de paginação
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Generate cache key based on all filters
    const cacheKey = CacheKeys.legislativeActs({
      type,
      issuer,
      year,
      search,
      articleNumber,
      page,
      limit,
    });

    // Use cached result or fetch from database
    const result = await withCache(
      cacheKey,
      async () => {
        // Construir where clause
        const where: Record<string, unknown> = {};

        if (type) {
          where.type = type;
        }

        if (issuer) {
          where.issuer = issuer;
        }

        if (year) {
          where.year = parseInt(year);
        }

        if (search) {
          where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { ementa: { contains: search, mode: 'insensitive' } },
            { fullNumber: { contains: search, mode: 'insensitive' } }
          ];
        }

        // Filtrar por artigo da Lei 14.133
        if (articleNumber) {
          where.leiArticles = {
            contains: `"${articleNumber}"`
          };
        }

        // Buscar atos
        const [acts, total] = await Promise.all([
          prisma.legislativeAct.findMany({
            where,
            select: {
              id: true,
              type: true,
              number: true,
              year: true,
              fullNumber: true,
              title: true,
              ementa: true,
              summary: true,
              issuer: true,
              publishDate: true,
              effectiveDate: true,
              hierarchyLevel: true,
              leiArticles: true,
              officialUrl: true,
              pdfUrl: true,
              viewCount: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: [
              { year: 'desc' },
              { hierarchyLevel: 'asc' },
              { publishDate: 'desc' }
            ],
            skip,
            take: limit
          }),
          prisma.legislativeAct.count({ where })
        ]);

        // Processar leiArticles (parsear JSON)
        const actsWithParsedData = acts.map(act => ({
          ...act,
          leiArticles: act.leiArticles ? JSON.parse(act.leiArticles) : []
        }));

        // Buscar estatísticas de filtros disponíveis
        const [typeStats, issuerStats, yearStats] = await Promise.all([
          prisma.legislativeAct.groupBy({
            by: ['type'],
            _count: true,
            orderBy: { _count: { type: 'desc' } }
          }),
          prisma.legislativeAct.groupBy({
            by: ['issuer'],
            _count: true,
            orderBy: { _count: { issuer: 'desc' } }
          }),
          prisma.legislativeAct.groupBy({
            by: ['year'],
            _count: true,
            orderBy: { year: 'desc' }
          })
        ]);

        return {
          acts: actsWithParsedData,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          },
          filters: {
            types: typeStats.map(s => ({ type: s.type, count: s._count })),
            issuers: issuerStats.map(s => ({ issuer: s.issuer, count: s._count })),
            years: yearStats.map(s => ({ year: s.year, count: s._count }))
          }
        };
      },
      CACHE_TTL.LEGISLATIVE_ACTS,
      { prefix: 'acts' }
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error('Erro ao listar atos normativos:', error);
    return NextResponse.json(
      { error: 'Erro ao listar atos normativos' },
      { status: 500 }
    );
  }
}
