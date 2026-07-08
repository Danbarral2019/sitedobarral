import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { courses } from '@/data/courses';
import { hybridSearch } from '@/lib/embeddings/hybrid-search';
import { apiLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, NotFoundError } from '@/lib/errors/api-error';
import {
  filterByEnrollment,
  dedupeByDocument,
  mapDocumentRowToResult,
  mapActRowToResult,
} from '@/lib/search/hybrid-documents';
import type { SearchResultItem } from '@/lib/types/global-search';

export const runtime = 'nodejs';
export const maxDuration = 30;

const DEFAULT_LIMIT = 40;

export async function GET(request: NextRequest) {
  try {
    // Auth (mesmo padrão do global-search — Fase 8)
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      throw new AuthenticationError();
    }
    const authPayload = await verifyToken(token);
    if (!authPayload) {
      throw new AuthenticationError();
    }

    const query = request.nextUrl.searchParams.get('q')?.trim() || '';
    if (query.length < 2) {
      return NextResponse.json({ results: [] } satisfies { results: SearchResultItem[] });
    }
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 100);

    // Matrículas (admin vê todos os cursos)
    const isAdmin = authPayload.role === 'admin';
    const user = await prisma.user.findUnique({
      where: { id: authPayload.userId },
      select: { id: true, enrollments: { select: { courseId: true } } },
    });
    if (!user) {
      throw new NotFoundError('Usuário');
    }
    const enrolledCourseIds = isAdmin
      ? courses.map((c) => c.id)
      : user.enrollments.map((e) => e.courseId);

    // Fase 2: híbrido (document + legislative-act). Fallback gracioso em qualquer erro.
    // ⚠️ Este try/catch interno é intencional e NÃO deve ser substituído por
    // handleApiError: zero regressão exige 200 {results:[]} (mantém o FTS já
    // exibido), nunca um 500.
    try {
      const { results } = await hybridSearch({
        query,
        limit: Math.ceil(limit * 1.5), // margem para o pós-filtro de acesso
        includeTribunalDecisions: false,
        useCache: true,
      });

      const allowed = dedupeByDocument(filterByEnrollment(results, enrolledCourseIds)).slice(0, limit);

      const docIds = allowed.filter((r) => r.sourceType === 'document').map((r) => r.documentId);
      const actIds = allowed.filter((r) => r.sourceType === 'legislative-act').map((r) => r.documentId);

      const [docRows, actRows] = await Promise.all([
        docIds.length
          ? prisma.document.findMany({
              where: { id: { in: docIds } },
              select: { id: true, title: true, description: true, category: true, type: true, url: true, courseId: true, tags: true, uploadedAt: true, isPublic: true },
            })
          : Promise.resolve([]),
        actIds.length
          ? prisma.legislativeAct.findMany({
              where: { id: { in: actIds } },
              select: { id: true, type: true, fullNumber: true, title: true, ementa: true, summary: true, issuer: true, publishDate: true, hierarchyLevel: true, leiArticlesArr: true, officialUrl: true, pdfUrl: true },
            })
          : Promise.resolve([]),
      ]);

      const docById = new Map(docRows.map((d) => [d.id, d]));
      const actById = new Map(actRows.map((a) => [a.id, a]));

      // Preserva a ordem de relevância do híbrido
      const items: SearchResultItem[] = [];
      for (const r of allowed) {
        if (r.sourceType === 'document') {
          const row = docById.get(r.documentId);
          if (row) items.push({ type: 'document', data: mapDocumentRowToResult(row) });
        } else if (r.sourceType === 'legislative-act') {
          const row = actById.get(r.documentId);
          if (row) items.push({ type: 'legislative-act', data: mapActRowToResult(row) });
        }
      }

      apiLogger.info({ query, count: items.length }, 'hybrid search list upgrade');
      return NextResponse.json({ results: items } satisfies { results: SearchResultItem[] });
    } catch (err) {
      // Zero regressão: falha do híbrido não quebra a lista (o FTS já está exibido).
      apiLogger.warn({ err: err instanceof Error ? err.message : String(err) }, 'hybrid search upgrade failed — degrada para FTS');
      return NextResponse.json({ results: [] } satisfies { results: SearchResultItem[] });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
