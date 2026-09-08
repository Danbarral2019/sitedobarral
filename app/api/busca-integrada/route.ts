import { NextRequest, NextResponse } from 'next/server';
import { searchLeiArticlesWithExcerpts } from '@/data/lei-14133-artigos';
import { verifyAuth, hasAnyActiveAccess } from '@/lib/auth';
import {
  searchDocuments,
  searchGlossary,
  searchLegislativeActs,
  searchBlogPosts,
  searchFAQs,
  searchTribunalDecisions,
} from '@/lib/search/full-text-search';
import { handleApiError } from '@/lib/errors/error-handler';
import { hybridSearch } from '@/lib/embeddings/hybrid-search';
import { dedupeByDocument } from '@/lib/search/hybrid-documents';
import { mesclarSemDuplicar, contarNovos } from '@/lib/search/mesclar-semantica';
import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { ValidationError } from '@/lib/errors/api-error';
import { z } from 'zod';

const SearchQuerySchema = z.string().trim().min(2).max(300);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedQuery = SearchQuerySchema.safeParse(searchParams.get('q'));
    if (!parsedQuery.success) {
      throw new ValidationError('Consulta de busca inválida', parsedQuery.error.issues);
    }
    const query = parsedQuery.data;

    const ip = getClientIp(request);
    await enforceRateLimit(`busca-integrada:${ip}`, 30, 60);

    // Verificar se usuário está autenticado (opcional — busca funciona sem login)
    const authResult = await verifyAuth(request);
    const isAuthenticated = authResult.valid;
    const userCourseId = isAuthenticated && authResult.user?.courseId
      ? authResult.user.courseId
      : null;

    // Quem já tem o assistente não deve ver a demonstração dele nem a oferta.
    // Admin e qualquer acesso ativo (matrícula válida ou assinatura) contam.
    const hasAiAccess = authResult.user
      ? authResult.user.role === 'admin' || await hasAnyActiveAccess(authResult.user.userId)
      : false;

    // Executar todas as buscas em paralelo via FTS (tsvector + stemming português)
    const [
      glossaryResults,
      actResults,
      docResults,
      decisionResults,
      blogResults,
      faqResults,
    ] = await Promise.all([
      searchGlossary(query, { limit: 5 }),
      searchLegislativeActs(query, { limit: 10 }),
      searchDocuments(query, { limit: 20 }),
      searchTribunalDecisions(query, { limit: 20 }),
      searchBlogPosts(query, { limit: 5 }),
      searchFAQs(query, { limit: 5 }),
    ]);

    // Busca semântica sobre os 27.291 chunks já indexados no pgvector, que até
    // aqui só a área logada usava. Full-text casa palavra; quem digita "posso
    // contratar sem licitação até quanto" não tem nenhuma dessas no título de
    // documento nenhum, e não achava o art. 75.
    //
    // Degrada em silêncio de propósito: sem chave do Gemini, com quota estourada
    // ou com o pgvector fora, a busca textual segue respondendo. Melhor uma
    // busca pior do que uma busca quebrada.
    //
    // Não vaza acervo pago: esta rota devolve título, descrição e categoria —
    // nunca o trecho do chunk. Documento restrito encontrado aqui aparece
    // marcado como restrito, igual ao que o full-text já fazia.
    const docsSemanticos = await buscarSemanticos(query, {
      userCourseId,
      isAdmin: authResult.user?.role === 'admin',
    }).catch(() => []);

    // Artigos da Lei 14.133 (busca local em dados estáticos)
    const articles = searchLeiArticlesWithExcerpts(query).slice(0, 10);

    // Processar documentos para indicar acessibilidade
    const processedDocuments = docResults.map(({ data: doc }) => {
      const isPublic = doc.is_public;
      const hasAccess = isPublic
        || (userCourseId && doc.course_id === userCourseId)
        || authResult.user?.role === 'admin';

      return {
        id: doc.id,
        title: doc.title,
        description: doc.description,
        category: doc.category,
        type: doc.type,
        url: doc.url,
        courseId: doc.course_id,
        uploadedAt: doc.uploaded_at,
        isPublic,
        hasAccess,
        requiresEnrollment: !hasAccess,
      };
    });

    const documentosFinais = mesclarSemDuplicar(processedDocuments, docsSemanticos, 20);
    if (docsSemanticos.length > 0) {
      apiLogger.info(
        { query, novos: contarNovos(processedDocuments, docsSemanticos) },
        'busca integrada: semântica acrescentou resultados',
      );
    }

    return NextResponse.json({
      query,
      viewer: { hasAiAccess },
      results: {
        glossaryTerms: glossaryResults.map(({ data }) => ({
          id: data.id,
          term: data.term,
          definition: data.definition,
          category: data.category,
        })),
        articles: articles.map(art => ({
          numero: art.numero,
          titulo: art.titulo,
          ementa: art.ementa,
          capitulo: art.capitulo,
          excerpts: art.excerpts,
        })),
        acts: actResults.map(({ data }) => ({
          id: data.id,
          fullNumber: data.full_number,
          title: data.title,
          ementa: data.ementa,
          type: data.type,
          issuer: data.issuer,
          publishDate: data.publish_date,
        })),
        documents: documentosFinais,
        decisions: decisionResults.map(({ data }) => ({
          id: data.id,
          tribunalCode: data.tribunal_code,
          tribunalName: data.tribunal_name,
          decisionType: data.decision_type,
          decisionNumber: data.decision_number,
          title: data.title,
          ementa: data.ementa,
          summary: data.summary,
          relator: data.relator,
          orgaoJulgador: data.orgao_julgador,
          dataJulgamento: data.data_julgamento,
          url: data.url,
        })),
        blogPosts: blogResults.map(({ data }) => ({
          id: data.id,
          slug: data.slug,
          title: data.title,
          excerpt: data.excerpt,
          author: data.author,
          publishedAt: data.published_at,
          tags: data.tags,
        })),
        faqs: faqResults.map(({ data }) => ({
          id: data.id,
          question: data.question,
          answer: data.answer,
          category: data.category,
        })),
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Documentos encontrados por similaridade semântica, no mesmo formato dos que
 * vêm do full-text. Devolve [] em qualquer falha — o chamador não trata erro.
 */
async function buscarSemanticos(
  query: string,
  acesso: { userCourseId: string | null; isAdmin: boolean },
) {
  const { results } = await hybridSearch({
    query,
    limit: 12,
    includeTribunalDecisions: false,
    useCache: true,
  });

  const ids = dedupeByDocument(results)
    .filter((r) => r.sourceType === 'document')
    .map((r) => r.documentId);

  if (ids.length === 0) return [];

  const rows = await prisma.document.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, title: true, description: true, category: true, type: true,
      url: true, courseId: true, uploadedAt: true, isPublic: true,
    },
  });

  // Preserva a ordem de relevância do híbrido, que o findMany não garante.
  const porId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const d = porId.get(id);
    if (!d) return [];
    // Mesma regra de acesso do ramo full-text: divergir aqui faria o mesmo
    // documento aparecer destravado ou trancado conforme o ramo que o achou.
    const hasAccess =
      d.isPublic ||
      (!!acesso.userCourseId && d.courseId === acesso.userCourseId) ||
      acesso.isAdmin;
    return [{
      id: d.id,
      title: d.title,
      description: d.description,
      category: d.category,
      type: d.type,
      url: d.url,
      courseId: d.courseId,
      uploadedAt: d.uploadedAt,
      isPublic: d.isPublic,
      hasAccess,
      requiresEnrollment: !hasAccess,
    }];
  });
}
