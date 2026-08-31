import { NextRequest, NextResponse } from 'next/server';
import { searchLeiArticlesWithExcerpts } from '@/data/lei-14133-artigos';
import { verifyAuth } from '@/lib/auth';
import {
  searchDocuments,
  searchGlossary,
  searchLegislativeActs,
  searchBlogPosts,
  searchFAQs,
  searchTribunalDecisions,
} from '@/lib/search/full-text-search';
import { handleApiError } from '@/lib/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json({
        query: query || '',
        results: {
          glossaryTerms: [],
          articles: [],
          acts: [],
          documents: [],
          decisions: [],
          blogPosts: [],
          faqs: [],
        }
      });
    }

    // Verificar se usuário está autenticado (opcional — busca funciona sem login)
    const authResult = await verifyAuth(request);
    const isAuthenticated = authResult.valid;
    const userCourseId = isAuthenticated && authResult.user?.courseId
      ? authResult.user.courseId
      : null;

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

    return NextResponse.json({
      query,
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
        documents: processedDocuments,
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
