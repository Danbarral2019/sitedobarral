import { NextRequest, NextResponse } from 'next/server';
import { searchLeiArticlesWithExcerpts } from '@/data/lei-14133-artigos';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json({
        query: query || '',
        results: {
          articles: [],
          acts: [],
          documents: []
        }
      });
    }

    // Verificar se usuário está autenticado
    const authResult = await verifyAuth(request);
    const isAuthenticated = authResult.valid;
    const userCourseId = isAuthenticated && authResult.user?.courseId
      ? authResult.user.courseId
      : null;

    // 1. Buscar artigos da Lei 14.133 com trechos relevantes
    const articles = searchLeiArticlesWithExcerpts(query).slice(0, 10); // Limitar a 10 resultados

    // 2. Buscar atos normativos
    const acts = await prisma.legislativeAct.findMany({
      where: {
        OR: [
          { fullNumber: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
          { ementa: { contains: query, mode: 'insensitive' } },
          { summary: { contains: query, mode: 'insensitive' } },
        ]
      },
      take: 10,
      orderBy: {
        publishDate: 'desc'
      }
    });

    // 3. Buscar documentos
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
        ]
      },
      take: 20,
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    // Processar documentos para indicar se são acessíveis
    const processedDocuments = documents.map(doc => {
      const isPublic = doc.isPublic;
      const hasAccess = isPublic || (userCourseId && doc.courseId === userCourseId) || authResult.user?.role === 'admin';

      return {
        id: doc.id,
        title: doc.title,
        description: doc.description,
        category: doc.category,
        type: doc.type,
        url: doc.url,
        courseId: doc.courseId,
        uploadedAt: doc.uploadedAt,
        isPublic: doc.isPublic,
        hasAccess: hasAccess,
        requiresEnrollment: !hasAccess,
      };
    });

    return NextResponse.json({
      query,
      results: {
        articles: articles.map(art => ({
          numero: art.numero,
          titulo: art.titulo,
          ementa: art.ementa,
          capitulo: art.capitulo,
          excerpts: art.excerpts, // Trechos relevantes com destaque
        })),
        acts: acts.map(act => ({
          id: act.id,
          fullNumber: act.fullNumber,
          title: act.title,
          ementa: act.ementa,
          type: act.type,
          issuer: act.issuer,
          publishDate: act.publishDate,
        })),
        documents: processedDocuments
      }
    });

  } catch (error) {
    console.error('[Busca Integrada] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao realizar busca' },
      { status: 500 }
    );
  }
}
