import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseLeiArticles, getLeiArticles } from '@/lib/lei-articles';
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/admin/analytics/article-coverage?articles=1,6,75
 *
 * Retorna estatísticas de cobertura para artigos específicos:
 * - Número de documentos vinculados
 * - Status: orphan, scarce, medium, good, excellent
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Extrair artigos da query string
    const { searchParams } = new URL(request.url);
    const articlesParam = searchParams.get('articles');

    if (!articlesParam) {
      return NextResponse.json(
        { error: 'Parâmetro "articles" é obrigatório (ex: ?articles=1,6,75)' },
        { status: 400 }
      );
    }

    const requestedArticles = articlesParam.split(',').map((n) => n.trim());

    console.log(`[Article Coverage] Analisando ${requestedArticles.length} artigos...`);

    // 3. Buscar todos os documentos com leiArticlesArr não-vazio
    const documentsWithArticles = await prisma.document.findMany({
      where: {
        leiArticlesArr: {
          isEmpty: false,
        },
      },
      select: {
        id: true,
        leiArticlesArr: true,
      },
    });

    // 4. Contar documentos por artigo
    const articleDocumentCount: Record<string, number> = {};

    documentsWithArticles.forEach((doc) => {
      const articles = getLeiArticles(doc);
      articles.forEach((artNum) => {
        const artStr = String(artNum);
        articleDocumentCount[artStr] = (articleDocumentCount[artStr] || 0) + 1;
      });
    });

    // 5. Calcular status para cada artigo requisitado
    const coverage = requestedArticles.map((artNum) => {
      const docCount = articleDocumentCount[artNum] || 0;

      let status: 'orphan' | 'scarce' | 'medium' | 'good' | 'excellent';

      if (docCount === 0) {
        status = 'orphan';
      } else if (docCount < 3) {
        status = 'scarce';
      } else if (docCount < 6) {
        status = 'medium';
      } else if (docCount < 15) {
        status = 'good';
      } else {
        status = 'excellent';
      }

      return {
        numero: artNum,
        documentCount: docCount,
        status,
      };
    });

    console.log(
      `[Article Coverage] Retornando stats para ${requestedArticles.length} artigos`
    );

    return NextResponse.json({
      coverage,
      total: requestedArticles.length,
    });
  } catch (error) {
    apiLogger.error({ err: error }, '[Article Coverage] Erro:');

    return NextResponse.json(
      {
        error: 'Erro ao calcular cobertura de artigos',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
