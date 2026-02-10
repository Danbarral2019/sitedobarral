import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/glossary/[slug] - Obter termo específico por slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const term = await prisma.glossaryTerm.findUnique({
      where: { slug },
      include: {
        // Não temos relations diretas, mas vamos buscar os relacionados depois
      },
    });

    if (!term) {
      return NextResponse.json(
        { error: 'Termo não encontrado' },
        { status: 404 }
      );
    }

    if (!term.isPublic) {
      return NextResponse.json(
        { error: 'Termo não disponível' },
        { status: 403 }
      );
    }

    // Incrementar contador de visualizações (async, não espera)
    prisma.glossaryTerm
      .update({
        where: { id: term.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch((err) => console.error('Error updating view count:', err));

    // Buscar termos relacionados (se houver)
    let relatedTerms = [];
    if (term.relatedTerms) {
      try {
        const relatedIds = JSON.parse(term.relatedTerms);
        if (Array.isArray(relatedIds) && relatedIds.length > 0) {
          relatedTerms = await prisma.glossaryTerm.findMany({
            where: {
              id: { in: relatedIds },
              isPublic: true,
            },
            select: {
              id: true,
              term: true,
              slug: true,
              shortDef: true,
              category: true,
            },
          });
        }
      } catch (e) {
        console.error('Error parsing relatedTerms:', e);
      }
    }

    // Buscar documentos relacionados (se houver)
    let relatedDocuments = [];
    if (term.relatedDocs) {
      try {
        const docIds = JSON.parse(term.relatedDocs);
        if (Array.isArray(docIds) && docIds.length > 0) {
          relatedDocuments = await prisma.document.findMany({
            where: {
              id: { in: docIds },
            },
            select: {
              id: true,
              title: true,
              description: true,
              type: true,
              category: true,
              courseId: true,
            },
            take: 10,
          });
        }
      } catch (e) {
        console.error('Error parsing relatedDocs:', e);
      }
    }

    // Parse leiArticles se houver
    let leiArticles = [];
    if (term.leiArticles) {
      try {
        leiArticles = JSON.parse(term.leiArticles);
      } catch (e) {
        console.error('Error parsing leiArticles:', e);
      }
    }

    return NextResponse.json({
      term: {
        ...term,
        relatedTerms: relatedTerms,
        relatedDocuments: relatedDocuments,
        leiArticles: leiArticles,
      },
    });
  } catch (error) {
    console.error('Error fetching glossary term:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar termo' },
      { status: 500 }
    );
  }
}
