import { NextRequest, NextResponse } from 'next/server';
import { searchLeiArticlesWithExcerpts } from '@/data/lei-14133-artigos';
import { verifyAuth } from '@/lib/auth';
import {
  getAcessoDoUsuario,
  podeVerDocumento,
  type AcessoDoUsuario,
} from '@/lib/search/acesso-documentos';
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
import { listarPorIds, type TeseCard } from '@/lib/teses/consultas';
import { visibilidadeDasTeses } from '@/lib/teses/visibilidade';
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
    const acesso = await getAcessoDoUsuario(authResult.valid ? authResult.user : null);

    // Quem já tem o assistente não deve ver a demonstração dele nem a oferta.
    // Admin e qualquer acesso ativo (matrícula válida ou assinatura) contam.
    const hasAiAccess = acesso.isAdmin || acesso.temAcessoAtivo;

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
    // Não vaza acervo pago: esta rota nunca devolve o trecho do chunk, e
    // documento que o leitor não pode ver sai sem url nem descrição (ver
    // paraResultado). O grafo de precedentes não aparece.
    const [docsSemanticos, teses] = await Promise.all([
      buscarSemanticos(query, acesso).catch(() => []),
      buscarTeses(query, hasAiAccess).catch((err) => {
        apiLogger.warn({ err, query }, 'busca integrada: busca das teses falhou');
        return [] as TeseCard[];
      }),
    ]);

    // Artigos da Lei 14.133 (busca local em dados estáticos)
    const articles = searchLeiArticlesWithExcerpts(query).slice(0, 10);

    // Processar documentos para indicar acessibilidade
    const processedDocuments = docResults.flatMap(({ data: doc }) => {
      const item = paraResultado({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        category: doc.category,
        type: doc.type,
        url: doc.url,
        courseId: doc.course_id,
        uploadedAt: doc.uploaded_at,
        isPublic: doc.is_public,
        isCommon: doc.is_common,
      }, acesso);
      return item ? [item] : [];
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
          revoked: data.revoked,
        })),
        documents: documentosFinais,
        teses,
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

interface DocumentoEncontrado {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: string;
  url: string | null;
  courseId: string | null;
  uploadedAt: Date;
  isPublic: boolean;
  isCommon: boolean;
}

/**
 * Formato de saída de um documento, com a regra única de acesso
 * (lib/search/acesso-documentos.ts) aplicada aos dois ramos, textual e
 * semântico. O que o leitor não pode ver:
 * - do acervo comum, aparece como vitrine ("Requer Inscrição"), sem url nem
 *   descrição;
 * - de resto (material de curso, grafo de precedentes), não aparece.
 */
function paraResultado(d: DocumentoEncontrado, acesso: AcessoDoUsuario) {
  const hasAccess = podeVerDocumento(d, acesso);
  if (!hasAccess && !d.isCommon) return null;
  return {
    id: d.id,
    title: d.title,
    description: hasAccess ? d.description : null,
    category: d.category,
    type: d.type,
    url: hasAccess ? d.url : null,
    courseId: d.courseId,
    uploadedAt: d.uploadedAt,
    isPublic: d.isPublic,
    hasAccess,
    requiresEnrollment: !hasAccess,
  };
}

/**
 * Documentos encontrados por similaridade semântica, no mesmo formato dos que
 * vêm do full-text. Devolve [] em qualquer falha — o chamador não trata erro.
 */
async function buscarSemanticos(query: string, acesso: AcessoDoUsuario) {
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
      url: true, courseId: true, uploadedAt: true, isPublic: true, isCommon: true,
    },
  });

  // Preserva a ordem de relevância do híbrido, que o findMany não garante.
  // Mesma regra de acesso do ramo full-text: divergir aqui faria o mesmo
  // documento aparecer destravado ou trancado conforme o ramo que o achou.
  const porId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const d = porId.get(id);
    const item = d ? paraResultado(d, acesso) : null;
    return item ? [item] : [];
  });
}

/**
 * As teses do TCU encontradas por similaridade semântica (spec §9).
 *
 * Chamada própria, e não um ramo a mais na de `buscarSemanticos`: lá os
 * resultados disputam o mesmo limite, e a tese, curta e escrita como súmula,
 * tende a pontuar alto e tomar o lugar dos documentos. Aqui ela só disputa
 * com outras teses.
 *
 * A visibilidade vem do leitor. `hasAiAccess` é a regra canônica de acesso
 * ativo (matrícula válida, assinatura ou admin), a mesma da página do acórdão.
 */
async function buscarTeses(query: string, comAcessoAtivo: boolean): Promise<TeseCard[]> {
  const { results } = await hybridSearch({
    query,
    limit: 8,
    includeTeses: true,
    tesesVisibilidade: visibilidadeDasTeses(comAcessoAtivo),
    skipDocumentBranch: true,
    skipLegislativeActBranch: true,
    // O full-text não conhece as teses; aqui ele só traria documentos.
    skipFts: true,
    useCache: true,
  });

  const ids = results.filter((r) => r.sourceType === 'tese').map((r) => r.documentId);
  return listarPorIds(ids, comAcessoAtivo);
}
