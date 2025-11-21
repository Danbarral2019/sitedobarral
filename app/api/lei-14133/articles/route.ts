import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { safeParseArray } from '@/lib/utils';

/**
 * GET /api/lei-14133/articles
 *
 * Retorna todos os artigos da Lei 14.133 com:
 * - Estrutura hierárquica (TÍTULO > CAPÍTULO > Seção)
 * - Contagem de documentos por artigo
 * - Dados completos do artigo (ementa, etc.)
 *
 * Query params opcionais:
 * - withDocuments=true - Incluir apenas artigos com documentos
 * - titulo=TÍTULO I - Filtrar por título específico
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticação (alunos ou admin)
    const authResult = await verifyAuth(request);
    if (!authResult.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const withDocumentsOnly = searchParams.get('withDocuments') === 'true';
    const tituloFilter = searchParams.get('titulo');

    console.log('[Lei Articles API] Buscando artigos da Lei 14.133...');

    // 2. Buscar todos os artigos (sem ordenação - faremos manualmente)
    const allArticles = await prisma.leiArticle.findMany({
      select: {
        id: true,
        numero: true,
        titulo: true,
        capituloCompleto: true,
        ementa: true,
        capitulo: true,
        secao: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Função para ordenação numérica correta
    // Ex: "1", "2", "10", "96", "100", "184-A"
    const sortArticlesNumerically = (a: { numero: string }, b: { numero: string }) => {
      // Extrair parte numérica e sufixo
      const extractParts = (num: string) => {
        const match = num.match(/^(\d+)(.*)$/);
        if (match) {
          return { numeric: parseInt(match[1], 10), suffix: match[2] || '' };
        }
        return { numeric: 0, suffix: num };
      };

      const partsA = extractParts(a.numero);
      const partsB = extractParts(b.numero);

      // Primeiro comparar numericamente
      if (partsA.numeric !== partsB.numeric) {
        return partsA.numeric - partsB.numeric;
      }

      // Se números iguais, comparar sufixo alfabeticamente
      return partsA.suffix.localeCompare(partsB.suffix);
    };

    // Ordenar artigos numericamente
    allArticles.sort(sortArticlesNumerically);

    // 3. Buscar todos os documentos com leiArticles
    const documentsWithArticles = await prisma.document.findMany({
      where: {
        leiArticles: {
          not: null,
        },
      },
      select: {
        id: true,
        title: true,
        leiArticles: true,
        isPublic: true,
      },
    });

    // 4. Contar documentos por artigo
    const articleDocumentCount: Record<string, number> = {};
    const articleDocuments: Record<string, { id: string; title: string; isPublic: boolean }[]> = {};

    documentsWithArticles.forEach((doc) => {
      const articles = safeParseArray(doc.leiArticles);
      articles.forEach((artNum) => {
        const artStr = String(artNum);
        articleDocumentCount[artStr] = (articleDocumentCount[artStr] || 0) + 1;

        if (!articleDocuments[artStr]) {
          articleDocuments[artStr] = [];
        }

        articleDocuments[artStr].push({
          id: doc.id,
          title: doc.title,
          isPublic: doc.isPublic,
        });
      });
    });

    // 5. Enriquecer artigos com contagem de documentos
    let enrichedArticles = allArticles.map((art) => ({
      ...art,
      documentCount: articleDocumentCount[art.numero] || 0,
      documents: articleDocuments[art.numero] || [],
    }));

    // 6. Aplicar filtros
    if (withDocumentsOnly) {
      enrichedArticles = enrichedArticles.filter((art) => art.documentCount > 0);
    }

    if (tituloFilter) {
      enrichedArticles = enrichedArticles.filter((art) => art.titulo === tituloFilter);
    }

    // 7. Agrupar por estrutura hierárquica
    const hierarchy: Record<
      string,
      {
        titulo: string;
        capitulos: Record<
          string,
          {
            capituloCompleto: string;
            artigos: typeof enrichedArticles;
          }
        >;
      }
    > = {};

    enrichedArticles.forEach((art) => {
      const titulo = art.titulo || 'Sem Título';
      const capituloKey = art.capitulo || 'Sem Capítulo';

      if (!hierarchy[titulo]) {
        hierarchy[titulo] = { titulo, capitulos: {} };
      }

      if (!hierarchy[titulo].capitulos[capituloKey]) {
        hierarchy[titulo].capitulos[capituloKey] = {
          capituloCompleto: art.capituloCompleto || capituloKey,
          artigos: [],
        };
      }

      hierarchy[titulo].capitulos[capituloKey].artigos.push(art);
    });

    // Ordenar artigos dentro de cada capítulo numericamente
    Object.values(hierarchy).forEach((titulo) => {
      Object.values(titulo.capitulos).forEach((capitulo) => {
        capitulo.artigos.sort(sortArticlesNumerically);
      });
    });

    console.log(
      `[Lei Articles API] Retornando ${enrichedArticles.length} artigos (${Object.keys(hierarchy).length} títulos)`
    );

    return NextResponse.json({
      articles: enrichedArticles,
      hierarchy,
      total: enrichedArticles.length,
      totalWithDocuments: enrichedArticles.filter((a) => a.documentCount > 0).length,
    });
  } catch (error) {
    console.error('[Lei Articles API] Erro:', error);

    return NextResponse.json(
      {
        error: 'Erro ao buscar artigos da Lei 14.133',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
