import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { listDocuments, deleteDocument } from '@/lib/documents';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { ValidationError, NotFoundError } from '@/lib/errors/api-error';

// GET - Lista todos os documentos (com filtros opcionais E paginação)
// OTIMIZAÇÃO: Adicionado suporte a paginação server-side
export const GET = withAdminApi(async (request: NextRequest) => {
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
});

// DELETE - Remove um documento
export const DELETE = withAdminApi(async (request: NextRequest) => {
  const { id } = await request.json();

  if (!id) {
    throw new ValidationError('ID do documento não fornecido');
  }

  const success = await deleteDocument(id);

  if (!success) {
    throw new NotFoundError('Documento');
  }

  // Invalidate caches - documents + lei articles (safe to invalidate all)
  await CacheInvalidation.courseDocuments();
  await CacheInvalidation.leiArticles();

  return NextResponse.json({ success: true });
});
