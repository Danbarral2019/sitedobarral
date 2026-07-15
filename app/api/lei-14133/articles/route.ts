import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseLeiArticles, getLeiArticles } from '@/lib/lei-articles';
import { INTERNAL_ONLY_CATEGORIES } from '@/lib/document-categories';
import { ARTIGOS_ENUNCIADOS, ENUNCIADOS } from '@/data/enunciados';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';

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
    // 1. Verificar autenticação (opcional - permite acesso público)
    const authResult = await verifyAuth(request);
    const isAuthenticated = authResult.valid;
    // Só admin vê documento privado — e é isto que a chave de cache precisa
    // separar, senão o aluno logado recebe o balde do admin.
    const isAdminUser = authResult.valid && authResult.user?.role === 'admin';

    const { searchParams } = new URL(request.url);
    const withDocumentsOnly = searchParams.get('withDocuments') === 'true';
    const tituloFilter = searchParams.get('titulo');

    // Generate cache key based on auth state and filters
    const filters = {
      withDocuments: withDocumentsOnly || undefined,
      titulo: tituloFilter || undefined,
    };
    const cacheKey = CacheKeys.leiArticles(isAdminUser, filters);

    // Use cached result or fetch from database
    const result = await withCache(
      cacheKey,
      async () => {
        console.log(`[Lei Articles API] Buscando artigos (autenticado: ${isAuthenticated})...`);

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
            professorComment: true,
            commentUpdatedAt: true,
            crossRefs: {
              select: { id: true, targetNumber: true, note: true, order: true },
              orderBy: { order: 'asc' },
            },
            suggestedReadings: {
              select: {
                id: true,
                kind: true,
                internalType: true,
                internalId: true,
                externalUrl: true,
                externalType: true,
                title: true,
                description: true,
                author: true,
                order: true,
              },
              orderBy: { order: 'asc' },
            },
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

        // 3. Buscar todos os documentos com leiArticles (filtrando por público se não autenticado)
        const documentsWithArticles = await prisma.document.findMany({
          where: {
            leiArticlesArr: {
              isEmpty: false,
            },
            // `lei-artigo` é o texto da própria Lei indexado para busca, não documento.
            category: { notIn: [...INTERNAL_ONLY_CATEGORIES] },
            // Só admin vê documento privado (curadoria) — ver article-docs/[numero].
            ...(!isAdminUser && { isPublic: true }),
          },
          select: {
            id: true,
            title: true,
            leiArticlesArr: true,
            leiArticlesCited: true,
            isPublic: true,
            category: true,
          },
        });

        // 3.1 Buscar todos os atos normativos (LegislativeAct) com leiArticles
        const legislativeActsWithArticles = await prisma.legislativeAct.findMany({
          where: {
            leiArticlesArr: {
              isEmpty: false,
            },
          },
          select: {
            id: true,
            fullNumber: true,
            title: true,
            leiArticlesArr: true,
            type: true,
            officialUrl: true,
          },
        });

        // 4. Contar documentos por artigo e agrupar por categoria
        const articleDocumentCount: Record<string, number> = {};
        const articleDocuments: Record<string, { id: string; title: string; isPublic: boolean; category: string | null; type?: string }[]> = {};

        // Adicionar documentos.
        // Conta apenas os que CITAM o artigo, para o número bater com o que a
        // página mostra. Antes contava todo vínculo, inclusive o temático que o
        // LLM inferiu sem menção — daí o art. 1º exibir "240 documentos" quando
        // só 41 o citam. Os temáticos seguem acessíveis na página, em seção
        // própria. Ref.: docs/audits/2026-07-15-lei-comentada-RESULTADOS.md
        documentsWithArticles.forEach((doc) => {
          const articles = getLeiArticles(doc);
          articles.forEach((artNum) => {
            const artStr = String(artNum);
            if (!doc.leiArticlesCited.includes(artStr)) return;

            articleDocumentCount[artStr] = (articleDocumentCount[artStr] || 0) + 1;

            if (!articleDocuments[artStr]) {
              articleDocuments[artStr] = [];
            }

            articleDocuments[artStr].push({
              id: doc.id,
              title: doc.title,
              isPublic: doc.isPublic,
              category: doc.category,
              type: 'document',
            });
          });
        });

        // Adicionar atos normativos (sempre públicos)
        legislativeActsWithArticles.forEach((act) => {
          const articles = getLeiArticles(act);
          articles.forEach((artNum) => {
            const artStr = String(artNum);
            articleDocumentCount[artStr] = (articleDocumentCount[artStr] || 0) + 1;

            if (!articleDocuments[artStr]) {
              articleDocuments[artStr] = [];
            }

            articleDocuments[artStr].push({
              id: act.id,
              title: `${act.fullNumber} - ${act.title}`,
              isPublic: true, // Atos normativos são sempre públicos
              category: act.type, // decreto, in, portaria, etc.
              type: 'legislativeAct',
            });
          });
        });

        // 5. Enriquecer artigos com contagem de documentos e enunciados
        let enrichedArticles = allArticles.map((art) => {
          // Buscar enunciados vinculados a este artigo
          const enunciadoIds = ARTIGOS_ENUNCIADOS[art.numero] || [];
          const enunciados = ENUNCIADOS.filter(e => enunciadoIds.includes(e.id)).map(e => ({
            id: e.id,
            orgao: e.orgao,
            numero: e.numero,
            texto: e.texto.substring(0, 200) + (e.texto.length > 200 ? '...' : ''),
            tema: e.tema,
            url: e.url,
          }));

          return {
            ...art,
            documentCount: articleDocumentCount[art.numero] || 0,
            documents: articleDocuments[art.numero] || [],
            enunciadoCount: enunciados.length,
            enunciados,
          };
        });

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

        return {
          articles: enrichedArticles,
          hierarchy,
          total: enrichedArticles.length,
          totalWithDocuments: enrichedArticles.filter((a) => a.documentCount > 0).length,
        };
      },
      CACHE_TTL.LEI_ARTICLES,
      { prefix: 'lei' }
    );

    return NextResponse.json(result);
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
