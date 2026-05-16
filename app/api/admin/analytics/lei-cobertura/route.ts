import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { safeParseArray } from '@/lib/utils';
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/admin/analytics/lei-cobertura
 *
 * Retorna estatísticas de cobertura da Lei 14.133/2021:
 * - Total de artigos vs artigos com documentos
 * - Percentual de cobertura
 * - Artigos órfãos (sem documentos)
 * - Artigos carentes (< 3 documentos)
 * - Distribuição por TÍTULO
 *
 * Usado no dashboard de cobertura da página de documentos (admin)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Lei Cobertura] Calculando estatísticas...');

    // 2. Buscar todos os artigos da lei
    const allArticles = await prisma.leiArticle.findMany({
      select: {
        id: true,
        numero: true,
        ementa: true,
        titulo: true,
        capitulo: true,
      },
      orderBy: {
        numero: 'asc',
      },
    });

    const totalArtigos = allArticles.length;

    // 3. Buscar todos os documentos que têm leiArticles vinculados
    const documentsWithArticles = await prisma.document.findMany({
      where: {
        leiArticles: {
          not: null,
        },
      },
      select: {
        id: true,
        leiArticles: true,
      },
    });

    // 4. Contar documentos por artigo
    const articleDocumentCount: Record<string, number> = {};

    documentsWithArticles.forEach((doc) => {
      const articles = safeParseArray(doc.leiArticles);
      articles.forEach((artNum) => {
        const artStr = String(artNum);
        articleDocumentCount[artStr] = (articleDocumentCount[artStr] || 0) + 1;
      });
    });

    // 5. Identificar artigos com documentos
    const artigosComDocumentos = allArticles.filter(
      (art) => articleDocumentCount[art.numero] > 0
    );

    const percentualCobertura = Math.round(
      (artigosComDocumentos.length / totalArtigos) * 100
    );

    // 6. Artigos órfãos (0 documentos)
    const artigosOrfaos = allArticles
      .filter((art) => !articleDocumentCount[art.numero])
      .slice(0, 10) // Top 10
      .map((art) => ({
        numero: art.numero,
        ementa: art.ementa.substring(0, 100) + '...',
        titulo: art.titulo || 'N/A',
        documentos: 0,
      }));

    // 7. Artigos carentes (1-2 documentos)
    const artigosPoucos = allArticles
      .filter(
        (art) =>
          articleDocumentCount[art.numero] > 0 &&
          articleDocumentCount[art.numero] < 3
      )
      .slice(0, 10) // Top 10
      .map((art) => ({
        numero: art.numero,
        ementa: art.ementa.substring(0, 100) + '...',
        titulo: art.titulo || 'N/A',
        documentos: articleDocumentCount[art.numero],
      }));

    // 8. Distribuição por TÍTULO
    const titulosMap: Record<
      string,
      { artigos: number; comDocs: number; totalDocs: number }
    > = {};

    allArticles.forEach((art) => {
      const titulo = art.titulo || 'Sem Título';

      if (!titulosMap[titulo]) {
        titulosMap[titulo] = { artigos: 0, comDocs: 0, totalDocs: 0 };
      }

      titulosMap[titulo].artigos += 1;

      if (articleDocumentCount[art.numero]) {
        titulosMap[titulo].comDocs += 1;
        titulosMap[titulo].totalDocs += articleDocumentCount[art.numero];
      }
    });

    const distribuicaoPorTitulo = Object.entries(titulosMap).map(
      ([titulo, stats]) => ({
        titulo,
        artigos: stats.artigos,
        comDocs: stats.comDocs,
        totalDocs: stats.totalDocs,
        cobertura: Math.round((stats.comDocs / stats.artigos) * 100),
      })
    );

    // 9. Total de documentos catalogados (com leiArticles)
    const totalDocumentosCatalogados = documentsWithArticles.length;

    console.log(
      `[Lei Cobertura] ${artigosComDocumentos.length}/${totalArtigos} artigos (${percentualCobertura}%)`
    );
    console.log(
      `[Lei Cobertura] ${totalDocumentosCatalogados} documentos catalogados`
    );

    return NextResponse.json({
      totalArtigos,
      artigosComDocumentos: artigosComDocumentos.length,
      percentualCobertura,
      totalDocumentosCatalogados,
      artigosOrfaos,
      artigosPoucos,
      distribuicaoPorTitulo,
    });
  } catch (error) {
    apiLogger.error({ err: error }, '[Lei Cobertura] Erro ao calcular cobertura:');

    return NextResponse.json(
      {
        error: 'Erro ao calcular cobertura da lei',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
