import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError } from '@/lib/errors/api-error';
import { getAcessoDoUsuario, podeVerDocumento } from '@/lib/search/acesso-documentos';

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.valid || !authResult.user) {
      throw new AuthenticationError();
    }

    const userId = authResult.user.userId;

    // Busca os últimos documentos acessados/baixados (ações: view, download, access)
    // Agrupa por documentId para não repetir, pega o mais recente de cada
    const recentLogs = await prisma.accessLog.findMany({
      where: {
        userId,
        documentId: { not: null },
        action: { in: ['view', 'download', 'access'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 30, // Busca mais para depois deduplicar
      select: {
        documentId: true,
        action: true,
        createdAt: true,
      },
    });

    // Deduplica por documentId, mantendo o acesso mais recente
    const seen = new Set<string>();
    const uniqueDocIds: string[] = [];
    const accessDates: Record<string, Date> = {};

    for (const log of recentLogs) {
      if (log.documentId && !seen.has(log.documentId)) {
        seen.add(log.documentId);
        uniqueDocIds.push(log.documentId);
        accessDates[log.documentId] = log.createdAt;
        if (uniqueDocIds.length >= 5) break;
      }
    }

    if (uniqueDocIds.length === 0) {
      return NextResponse.json({ recentDocuments: [] });
    }

    // Busca dados dos documentos. O log aceita qualquer id que o cliente
    // mandou no passado: só sai o que o usuário pode ver hoje.
    const [rows, acesso] = await Promise.all([
      prisma.document.findMany({
        where: { id: { in: uniqueDocIds } },
        select: {
          id: true,
          title: true,
          category: true,
          courseId: true,
          url: true,
          isPublic: true,
          isCommon: true,
        },
      }),
      getAcessoDoUsuario(authResult.user),
    ]);
    const documents = rows.filter((d) => podeVerDocumento(d, acesso));

    // Mantém a ordem de acesso recente e adiciona data
    const recentDocuments = uniqueDocIds
      .map(docId => {
        const doc = documents.find(d => d.id === docId);
        if (!doc) return null;
        return {
          id: doc.id,
          title: doc.title,
          category: doc.category,
          courseId: doc.courseId,
          url: doc.url,
          lastAccessedAt: accessDates[docId].toISOString(),
        };
      })
      .filter(Boolean);

    return NextResponse.json({ recentDocuments });
  } catch (error) {
    return handleApiError(error);
  }
}
