import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL, CacheInvalidation } from '@/lib/cache/redis-client';

/**
 * GET /api/legislative-acts
 * API pública para listar atos normativos e boas práticas
 * Suporta filtros, busca e abas (tab)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parâmetros de filtro
    const tab = searchParams.get('tab') || 'atos'; // 'atos' | 'boas-praticas'
    const type = searchParams.get('type'); // decreto, portaria, in, etc.
    const issuer = searchParams.get('issuer'); // Presidência, SEGES, MGI, etc.
    const year = searchParams.get('year');
    const search = searchParams.get('search'); // Busca por título/ementa
    const articleNumber = searchParams.get('article'); // Filtrar por artigo da Lei 14.133
    const esfera = searchParams.get('esfera'); // 'federal' | 'estadual'
    const theme = searchParams.get('theme'); // tema da taxonomia

    // Parâmetros de paginação
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Revalidação sob demanda via CRON_SECRET
    const revalidate = searchParams.get('_revalidate');
    if (revalidate && revalidate === process.env.CRON_SECRET) {
      await CacheInvalidation.legislativeActs();
    }

    // Generate cache key based on all filters
    const cacheKey = CacheKeys.legislativeActs({
      type,
      issuer,
      year,
      search,
      articleNumber,
      page,
      limit,
    }) + `:tab=${tab}:esf=${esfera || ''}:th=${theme || ''}`;

    // Use cached result or fetch from database
    const result = await withCache(
      cacheKey,
      async () => {
        if (tab === 'boas-praticas') {
          return await fetchBoasPraticas({ search, year, esfera, theme, issuer, page, limit, skip });
        }
        if (tab === 'tic') {
          return await fetchAtosNormativos({ type, issuer, year, search, articleNumber, esfera, theme: theme || 'tic', page, limit, skip, ticOnly: true });
        }
        return await fetchAtosNormativos({ type, issuer, year, search, articleNumber, esfera, theme, page, limit, skip });
      },
      CACHE_TTL.LEGISLATIVE_ACTS,
      { prefix: 'acts' }
    );

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });

  } catch (error) {
    console.error('Erro ao listar atos normativos:', error);
    return NextResponse.json(
      { error: 'Erro ao listar atos normativos' },
      { status: 500 }
    );
  }
}

// ===========================
// Atos Normativos (LegislativeAct)
// ===========================

interface AtosParams {
  type: string | null;
  issuer: string | null;
  year: string | null;
  search: string | null;
  articleNumber: string | null;
  esfera: string | null;
  theme: string | null;
  page: number;
  limit: number;
  skip: number;
  ticOnly?: boolean;
}

async function fetchAtosNormativos(params: AtosParams) {
  const { type, issuer, year, search, articleNumber, esfera, theme, page, limit, skip, ticOnly } = params;

  // Construir where clause
  const where: Record<string, unknown> = {};

  if (type) where.type = type;
  if (issuer) where.issuer = issuer;
  if (year) where.year = parseInt(year);
  if (esfera) where.esfera = esfera;

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { ementa: { contains: search, mode: 'insensitive' } },
      { fullNumber: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (articleNumber) {
    where.leiArticles = { contains: `"${articleNumber}"` };
  }

  if (theme) {
    where.themes = { contains: `"${theme}"` };
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
        esfera: true,
        themes: true,
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

  // Processar leiArticles e themes (parsear JSON)
  const actsWithParsedData = acts.map(act => ({
    ...act,
    leiArticles: act.leiArticles ? JSON.parse(act.leiArticles) : [],
    themes: act.themes ? JSON.parse(act.themes) : [],
  }));

  // Buscar estatísticas de filtros disponíveis (respeitando filtro TIC)
  const statsWhere = ticOnly ? { themes: { contains: '"tic"' } } : {};
  const [typeStats, issuerStats, yearStats, esferaStats] = await Promise.all([
    prisma.legislativeAct.groupBy({
      by: ['type'],
      where: statsWhere,
      _count: true,
      orderBy: { _count: { type: 'desc' } }
    }),
    prisma.legislativeAct.groupBy({
      by: ['issuer'],
      where: statsWhere,
      _count: true,
      orderBy: { _count: { issuer: 'desc' } }
    }),
    prisma.legislativeAct.groupBy({
      by: ['year'],
      where: statsWhere,
      _count: true,
      orderBy: { year: 'desc' }
    }),
    prisma.legislativeAct.groupBy({
      by: ['esfera'],
      where: statsWhere,
      _count: true,
    }),
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
      years: yearStats.map(s => ({ year: s.year, count: s._count })),
      esferas: esferaStats.map(s => ({ esfera: s.esfera, count: s._count })),
    }
  };
}

// ===========================
// Boas Práticas (Document com category='boa_pratica')
// ===========================

interface BoasPraticasParams {
  search: string | null;
  year: string | null;
  esfera: string | null;
  theme: string | null;
  issuer: string | null;
  page: number;
  limit: number;
  skip: number;
}

async function fetchBoasPraticas(params: BoasPraticasParams) {
  const { search, year, esfera, theme, issuer, page, limit, skip } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    category: 'boa_pratica',
    isPublic: true,
    reviewed: true,
  };

  if (esfera) where.esfera = esfera;
  if (theme) where.themes = { contains: `"${theme}"` };
  if (issuer) where.issuerOrg = { contains: issuer, mode: 'insensitive' };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (year) {
    const yearNum = parseInt(year);
    where.douData = {
      gte: new Date(yearNum, 0, 1),
      lt: new Date(yearNum + 1, 0, 1),
    };
  }

  const [docs, total] = await Promise.all([
    prisma.document.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        url: true,
        douUrl: true,
        douData: true,
        issuerOrg: true,
        esfera: true,
        themes: true,
        leiArticles: true,
        uploadedAt: true,
      },
      orderBy: [
        { douData: 'desc' },
        { uploadedAt: 'desc' },
      ],
      skip,
      take: limit,
    }),
    prisma.document.count({ where }),
  ]);

  // Adaptar para formato similar ao dos atos
  const acts = docs.map(doc => ({
    id: doc.id,
    type: 'boa_pratica',
    title: doc.title,
    ementa: doc.description || '',
    issuer: doc.issuerOrg || 'Não informado',
    publishDate: doc.douData || doc.uploadedAt,
    esfera: doc.esfera || 'federal',
    themes: doc.themes ? JSON.parse(doc.themes) : [],
    leiArticles: doc.leiArticles ? JSON.parse(doc.leiArticles) : [],
    officialUrl: doc.douUrl || doc.url,
    url: doc.url,
  }));

  // Buscar facets para boas práticas (usa select mínimo para performance)
  const allBoasPraticas = await prisma.document.findMany({
    where: { category: 'boa_pratica', isPublic: true, reviewed: true },
    select: { issuerOrg: true, esfera: true, douData: true },
  });

  const issuerCounts = new Map<string, number>();
  const esferaCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();

  for (const bp of allBoasPraticas) {
    // Usar apenas o órgão de primeiro nível para o filtro (antes do primeiro /)
    const fullOrg = bp.issuerOrg || 'Não informado';
    const topLevelOrg = fullOrg.split('/')[0].trim();
    issuerCounts.set(topLevelOrg, (issuerCounts.get(topLevelOrg) || 0) + 1);

    const esf = bp.esfera || 'federal';
    esferaCounts.set(esf, (esferaCounts.get(esf) || 0) + 1);

    if (bp.douData) {
      const y = new Date(bp.douData).getFullYear();
      yearCounts.set(y, (yearCounts.get(y) || 0) + 1);
    }
  }

  return {
    acts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    filters: {
      types: [],
      issuers: [...issuerCounts.entries()]
        .map(([issuer, count]) => ({ issuer, count }))
        .sort((a, b) => b.count - a.count),
      years: [...yearCounts.entries()]
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => b.year - a.year),
      esferas: [...esferaCounts.entries()]
        .map(([esfera, count]) => ({ esfera, count })),
    },
  };
}
