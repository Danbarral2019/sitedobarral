import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError, ConflictError, ValidationError } from '@/lib/errors/api-error';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { scrapeAndIndexAct } from '@/lib/legislative-scrapers/scrape-and-index';
import { validateActContent } from '@/lib/legislative-scrapers/validate-content';
import { normalizeScrapedText } from '@/lib/legislative-scrapers/normalize';
import { getHierarchyLevel } from '@/lib/legislative-acts/hierarchy';
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/admin/legislative-acts
 * Lista todos os atos normativos com filtros e paginação
 */
export const GET = withAdminApi(async (request) => {
  const { searchParams } = new URL(request.url);

  // Parâmetros de filtro
  const type = searchParams.get('type'); // decreto, portaria, in, etc.
  const issuer = searchParams.get('issuer'); // Presidência, SEGES, MGI, etc.
  const year = searchParams.get('year');
  const search = searchParams.get('search'); // Busca por título/ementa

  // Parâmetros de paginação
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const skip = (page - 1) * limit;

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

  // Buscar atos
  const [acts, total] = await Promise.all([
    prisma.legislativeAct.findMany({
      where,
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

  // Buscar estatísticas gerais
  const stats = await prisma.legislativeAct.groupBy({
    by: ['type'],
    _count: true
  });

  const statsMap = stats.reduce((acc, stat) => {
    acc[stat.type] = stat._count;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({
    acts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    stats: statsMap
  });
});

/**
 * POST /api/admin/legislative-acts
 * Cria um novo ato normativo
 */
export const POST = withAdminApi(async (request, ctx) => {
  const body = await request.json();

  // Validar campos obrigatórios
  const requiredFields = ['type', 'number', 'year', 'title', 'ementa', 'issuer', 'publishDate'];
  for (const field of requiredFields) {
    if (!body[field]) {
      throw new ValidationError(`Campo obrigatório: ${field}`);
    }
  }

  // Gerar fullNumber automaticamente se não fornecido
  let fullNumber = body.fullNumber;
  if (!fullNumber) {
    const typeLabelMap: Record<string, string> = {
      'decreto': 'Decreto',
      'portaria': 'Portaria',
      'in': 'IN SEGES',
      'ordem-servico': 'Ordem de Serviço',
      'lei': 'Lei',
      'medida-provisoria': 'Medida Provisória'
    };
    const typeLabel = typeLabelMap[body.type as string] || body.type;

    fullNumber = `${typeLabel} ${body.number}/${body.year}`;
  }

  // Calcular hierarchyLevel se não fornecido. Fonte canônica em
  // lib/legislative-acts/hierarchy.ts (antes daqui um mapeamento inline
  // marcava 'medida-provisoria: 2', errado — MP tem força de lei).
  let hierarchyLevel = body.hierarchyLevel;
  if (!hierarchyLevel) {
    hierarchyLevel = getHierarchyLevel(body.type);
  }

  // Normalizar ementa + content ANTES de salvar — garante que NBSP,
  // zero-width chars, boilerplate residual nunca entrem no banco.
  const normalizedEmenta = normalizeScrapedText(body.ementa as string);
  const normalizedContent = body.content ? normalizeScrapedText(body.content as string) : null;

  // Validar formatação. Errors bloqueiam o save (mojibake, FAQ no lugar
  // do ato, ementa fragmento, title com U+FFFD, publishDate.year ≠ year).
  // Warnings vão pro response mas não bloqueiam.
  const validation = validateActContent({
    url: body.officialUrl,
    content: normalizedContent ?? '',
    ementa: normalizedEmenta,
    title: body.title,
    year: parseInt(body.year),
    publishDate: body.publishDate ? new Date(body.publishDate) : null,
  });
  if (!validation.ok && normalizedContent) {
    // Só bloqueia quando há content (criação só com ementa não tem content
    // pra validar — usuário pode estar criando o esqueleto e o cron scrape
    // depois).
    throw new ApiError(422, 'Validação de formatação falhou', 'VALIDATION_ERROR', {
      details: validation.errors,
      warnings: validation.warnings,
    });
  }

  // Criar ato normativo
  try {
    const act = await prisma.legislativeAct.create({
      data: {
        type: body.type,
        number: body.number,
        year: parseInt(body.year),
        fullNumber,
        title: body.title,
        ementa: normalizedEmenta,
        summary: body.summary || null,
        issuer: body.issuer,
        publishDate: new Date(body.publishDate),
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : null,
        hierarchyLevel,
        leiArticles: body.leiArticles ? JSON.stringify(body.leiArticles) : null,
        officialUrl: body.officialUrl || null,
        pdfUrl: body.pdfUrl || null,
        content: normalizedContent,
        createdBy: ctx.user.email
      }
    });

    // Invalidate caches (legislative acts + lei articles if linked)
    await CacheInvalidation.legislativeActs();
    if (body.leiArticles && body.leiArticles.length > 0) {
      await CacheInvalidation.leiArticles();
    }

    // Scrape + index se tem officialUrl e não veio content no body
    if (act.officialUrl && !body.content) {
      scrapeAndIndexAct(act.id).catch(err =>
        apiLogger.error({ err: err }, `[Admin LegActs] Erro scrape+index ${act.id}:`)
      );
    }

    return NextResponse.json({
      success: true,
      act,
      warnings: validation.warnings,
    }, { status: 201 });
  } catch (error: unknown) {
    // Erro de unique constraint (fullNumber duplicado) — converter para
    // ConflictError; demais erros sobem para handleApiError.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new ConflictError('Já existe um ato normativo com este número/ano');
    }
    throw error;
  }
});
