import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// Função helper para gerar slug
function generateSlug(term: string): string {
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
    .trim()
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/-+/g, '-'); // Remove hífens duplicados
}

// GET /api/admin/glossary - Listar todos os termos (incluindo não publicados)
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const isPublic = searchParams.get('isPublic');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Construir filtros
    const where: Prisma.GlossaryTermWhereInput = {};

    if (category) {
      where.category = category;
    }

    if (isPublic !== null && isPublic !== undefined) {
      where.isPublic = isPublic === 'true';
    }

    // Buscar termos
    const [terms, total] = await Promise.all([
      prisma.glossaryTerm.findMany({
        where,
        orderBy: {
          term: 'asc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.glossaryTerm.count({ where }),
    ]);

    // Buscar todas as categorias
    const allTerms = await prisma.glossaryTerm.findMany({
      select: { category: true },
    });
    const categories = [...new Set(allTerms.map((t) => t.category).filter(Boolean))].sort();

    return NextResponse.json({
      terms,
      total,
      categories,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching glossary terms (admin):', error);
    return NextResponse.json(
      { error: 'Erro ao buscar termos' },
      { status: 500 }
    );
  }
}

// POST /api/admin/glossary - Criar novo termo
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      term,
      definition,
      shortDef,
      category,
      relatedTerms,
      leiArticles,
      relatedDocs,
      externalUrl,
      isPublic = true,
    } = body;

    // Validações
    if (!term || !definition) {
      return NextResponse.json(
        { error: 'Termo e definição são obrigatórios' },
        { status: 400 }
      );
    }

    // Gerar slug
    const slug = generateSlug(term);

    // Verificar se já existe termo com mesmo nome
    const existing = await prisma.glossaryTerm.findFirst({
      where: {
        OR: [{ term }, { slug }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe um termo com este nome' },
        { status: 400 }
      );
    }

    // Preparar dados para salvar
    const data: Prisma.GlossaryTermCreateInput = {
      term: term.trim(),
      slug,
      definition: definition.trim(),
      shortDef: shortDef?.trim() || null,
      category: category?.trim() || null,
      externalUrl: externalUrl?.trim() || null,
      isPublic,
      createdBy: authResult.user.email,
    };

    // Adicionar relacionamentos como JSON (se fornecidos)
    if (relatedTerms && Array.isArray(relatedTerms)) {
      data.relatedTerms = JSON.stringify(relatedTerms);
    }

    if (leiArticles && Array.isArray(leiArticles)) {
      data.leiArticles = JSON.stringify(leiArticles);
    }

    if (relatedDocs && Array.isArray(relatedDocs)) {
      data.relatedDocs = JSON.stringify(relatedDocs);
    }

    // Criar termo
    const newTerm = await prisma.glossaryTerm.create({
      data,
    });

    return NextResponse.json(
      { term: newTerm, message: 'Termo criado com sucesso' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating glossary term:', error);
    return NextResponse.json(
      { error: 'Erro ao criar termo' },
      { status: 500 }
    );
  }
}
