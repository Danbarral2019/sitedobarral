import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { listDocuments, deleteDocument } from '@/lib/documents';
import { CacheInvalidation } from '@/lib/cache/redis-client';

// GET - Lista todos os documentos (com filtros opcionais E paginação)
// OTIMIZAÇÃO: Adicionado suporte a paginação server-side
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    console.log('[API] Iniciando listagem de documentos...');

    // Extrair filtros E paginação da query string
    const { searchParams } = new URL(request.url);
    const reviewed = searchParams.get('reviewed');
    const category = searchParams.get('category');
    const period = searchParams.get('period');
    const page = searchParams.get('page') || '1';
    const pageSize = searchParams.get('pageSize') || '50';

    const result = await listDocuments({ reviewed, category, period, page, pageSize });
    console.log(`[API] Documentos carregados: ${result.documents.length} de ${result.total} (página ${result.page}/${result.totalPages})`);

    // Retornar documentos + metadados de paginação
    return NextResponse.json({
      documents: result.documents,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      }
    });
  } catch (error) {
    console.error('[API] Erro ao listar documentos:', error);
    console.error('[API] Stack:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json(
      {
        error: 'Erro ao listar documentos',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
});

// DELETE - Remove um documento
export const DELETE = withAdminAuth(async (request: NextRequest) => {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID do documento não fornecido' },
        { status: 400 }
      );
    }

    const success = await deleteDocument(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    // Invalidate caches - documents + lei articles (safe to invalidate all)
    await CacheInvalidation.courseDocuments();
    await CacheInvalidation.leiArticles();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar documento:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar documento' },
      { status: 500 }
    );
  }
});
