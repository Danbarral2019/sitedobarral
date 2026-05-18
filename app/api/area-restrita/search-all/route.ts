import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { apiLogger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyAuth(request);
    if (!authResult.valid || !authResult.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const courseId = searchParams.get('courseId');

    if (!query || query.length < 2) {
      return NextResponse.json({
        documents: [],
        glossaryTerms: [],
        totalDocuments: 0,
        totalGlossary: 0,
      });
    }

    const searchTerms = query.toLowerCase();

    // Buscar documentos
    const whereDocuments = {
      OR: [
        { title: { contains: searchTerms, mode: 'insensitive' as const } },
        { description: { contains: searchTerms, mode: 'insensitive' as const } },
        { tags: { contains: searchTerms, mode: 'insensitive' as const } },
      ],
      ...(courseId && courseId !== 'all' ? {
        AND: [
          {
            OR: [
              { courseId: courseId },
              { isCommon: true },
            ],
          },
        ],
      } : {}),
    };

    const documents = await prisma.document.findMany({
      where: whereDocuments,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        category: true,
        courseId: true,
        tags: true,
        uploadedAt: true,
        url: true,
        isPublic: true,
      },
      orderBy: { uploadedAt: 'desc' },
      take: 20,
    });

    // Buscar termos do glossário (apenas públicos)
    const glossaryTerms = await prisma.glossaryTerm.findMany({
      where: {
        isPublic: true,
        OR: [
          { term: { contains: searchTerms, mode: 'insensitive' } },
          { definition: { contains: searchTerms, mode: 'insensitive' } },
          { shortDef: { contains: searchTerms, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        term: true,
        slug: true,
        definition: true,
        shortDef: true,
        category: true,
        viewCount: true,
      },
      orderBy: { viewCount: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      documents,
      glossaryTerms,
      totalDocuments: documents.length,
      totalGlossary: glossaryTerms.length,
      query,
    });
  } catch (error) {
    apiLogger.error({ err: error }, 'Error searching:');
    return NextResponse.json(
      { error: 'Erro ao buscar' },
      { status: 500 }
    );
  }
}
