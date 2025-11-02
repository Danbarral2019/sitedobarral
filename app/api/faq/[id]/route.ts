import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/faq/[id] - Obter FAQ específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const faq = await prisma.fAQ.findUnique({
      where: { id },
    });

    if (!faq) {
      return NextResponse.json(
        { error: 'Pergunta não encontrada' },
        { status: 404 }
      );
    }

    if (!faq.isPublished) {
      return NextResponse.json(
        { error: 'Pergunta não disponível' },
        { status: 403 }
      );
    }

    // Buscar FAQs relacionadas (se houver)
    let relatedFAQs = [];
    if (faq.relatedFAQs) {
      try {
        const relatedIds = JSON.parse(faq.relatedFAQs);
        if (Array.isArray(relatedIds) && relatedIds.length > 0) {
          relatedFAQs = await prisma.fAQ.findMany({
            where: {
              id: { in: relatedIds },
              isPublished: true,
            },
            select: {
              id: true,
              question: true,
              category: true,
            },
          });
        }
      } catch (e) {
        console.error('Error parsing relatedFAQs:', e);
      }
    }

    // Buscar documentos relacionados (se houver)
    let relatedDocuments = [];
    if (faq.relatedDocs) {
      try {
        const docIds = JSON.parse(faq.relatedDocs);
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
            take: 5,
          });
        }
      } catch (e) {
        console.error('Error parsing relatedDocs:', e);
      }
    }

    return NextResponse.json({
      faq: {
        ...faq,
        relatedFAQs,
        relatedDocuments,
      },
    });
  } catch (error) {
    console.error('Error fetching FAQ:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar pergunta' },
      { status: 500 }
    );
  }
}
