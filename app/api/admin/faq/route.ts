import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { CacheInvalidation } from '@/lib/cache/redis-client';

// GET /api/admin/faq - Listar todas as FAQs (incluindo não publicadas)
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const isPublished = searchParams.get('isPublished');

    // ✅ Paginação
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50')));
    const skip = (page - 1) * pageSize;

    // Construir filtros
    const where: Prisma.FAQWhereInput = {};

    if (category) {
      where.category = category;
    }

    if (isPublished !== null && isPublished !== undefined) {
      where.isPublished = isPublished === 'true';
    }

    // ✅ Buscar FAQs com LIMITE e contar em paralelo
    const [faqs, total, allFaqs] = await Promise.all([
      prisma.fAQ.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' },
          { displayOrder: 'asc' },
          { createdAt: 'desc' },
        ],
        take: pageSize,
        skip,
      }),
      prisma.fAQ.count({ where }),
      // Buscar todas as categorias (apenas campo category)
      prisma.fAQ.findMany({
        select: { category: true },
      }),
    ]);

    const categories = [...new Set(allFaqs.map((f) => f.category))].sort();

    return NextResponse.json({
      success: true,
      faqs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: skip + pageSize < total,
        hasPrev: page > 1,
      },
      categories,
    });
  } catch (error) {
    console.error('Error fetching FAQs (admin):', error);
    return NextResponse.json(
      { error: 'Erro ao buscar perguntas' },
      { status: 500 }
    );
  }
}

// POST /api/admin/faq - Criar nova FAQ
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      question,
      answer,
      category,
      displayOrder = 0,
      isPinned = false,
      isPublished = true,
      relatedFAQs,
      relatedDocs,
      keywords,
    } = body;

    // Validações
    if (!question || !answer || !category) {
      return NextResponse.json(
        { error: 'Pergunta, resposta e categoria são obrigatórios' },
        { status: 400 }
      );
    }

    // Preparar dados
    const data: Prisma.FAQCreateInput = {
      question: question.trim(),
      answer: answer.trim(),
      category: category.trim(),
      displayOrder,
      isPinned,
      isPublished,
      createdBy: authResult.user?.email,
    };

    // Adicionar relacionamentos como JSON (se fornecidos)
    if (relatedFAQs && Array.isArray(relatedFAQs)) {
      data.relatedFAQs = JSON.stringify(relatedFAQs);
    }

    if (relatedDocs && Array.isArray(relatedDocs)) {
      data.relatedDocs = JSON.stringify(relatedDocs);
    }

    if (keywords && Array.isArray(keywords)) {
      data.keywords = JSON.stringify(keywords);
    }

    // Criar FAQ
    const newFaq = await prisma.fAQ.create({
      data,
    });

    // Invalidate FAQ cache
    await CacheInvalidation.faq();

    return NextResponse.json(
      { faq: newFaq, message: 'Pergunta criada com sucesso' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating FAQ:', error);
    return NextResponse.json(
      { error: 'Erro ao criar pergunta' },
      { status: 500 }
    );
  }
}
