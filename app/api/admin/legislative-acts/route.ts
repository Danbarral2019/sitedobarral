import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';

/**
 * GET /api/admin/legislative-acts
 * Lista todos os atos normativos com filtros e paginação
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar se é admin
    const adminCheck = await verifyAdmin(request);
    if (adminCheck.error) {
      return adminCheck.response;
    }

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
    const where: any = {};

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

  } catch (error) {
    console.error('Erro ao listar atos normativos:', error);
    return NextResponse.json(
      { error: 'Erro ao listar atos normativos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/legislative-acts
 * Cria um novo ato normativo
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar se é admin
    const adminCheck = await verifyAdmin(request);
    if (adminCheck.error) {
      return adminCheck.response;
    }

    const body = await request.json();
    const { user } = adminCheck;

    // Validar campos obrigatórios
    const requiredFields = ['type', 'number', 'year', 'title', 'ementa', 'issuer', 'publishDate'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Campo obrigatório: ${field}` },
          { status: 400 }
        );
      }
    }

    // Gerar fullNumber automaticamente se não fornecido
    let fullNumber = body.fullNumber;
    if (!fullNumber) {
      const typeLabel = {
        'decreto': 'Decreto',
        'portaria': 'Portaria',
        'in': 'IN SEGES',
        'ordem-servico': 'Ordem de Serviço',
        'lei': 'Lei',
        'medida-provisoria': 'Medida Provisória'
      }[body.type] || body.type;

      fullNumber = `${typeLabel} ${body.number}/${body.year}`;
    }

    // Calcular hierarchyLevel se não fornecido
    let hierarchyLevel = body.hierarchyLevel;
    if (!hierarchyLevel) {
      const hierarchy: Record<string, number> = {
        'lei': 1,
        'medida-provisoria': 2,
        'decreto': 2,
        'portaria': 3,
        'in': 4,
        'ordem-servico': 5
      };
      hierarchyLevel = hierarchy[body.type] || 5;
    }

    // Criar ato normativo
    const act = await prisma.legislativeAct.create({
      data: {
        type: body.type,
        number: body.number,
        year: parseInt(body.year),
        fullNumber,
        title: body.title,
        ementa: body.ementa,
        summary: body.summary || null,
        issuer: body.issuer,
        publishDate: new Date(body.publishDate),
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : null,
        hierarchyLevel,
        leiArticles: body.leiArticles ? JSON.stringify(body.leiArticles) : null,
        officialUrl: body.officialUrl || null,
        pdfUrl: body.pdfUrl || null,
        content: body.content || null,
        createdBy: user.email
      }
    });

    return NextResponse.json({
      success: true,
      act
    }, { status: 201 });

  } catch (error: any) {
    console.error('Erro ao criar ato normativo:', error);

    // Erro de unique constraint (fullNumber duplicado)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe um ato normativo com este número/ano' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao criar ato normativo' },
      { status: 500 }
    );
  }
}
