import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { listDocuments, deleteDocument } from '@/lib/documents';

// GET - Lista todos os documentos (com filtros opcionais)
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    console.log('[API] Iniciando listagem de documentos...');

    // Extrair filtros da query string
    const { searchParams } = new URL(request.url);
    const reviewed = searchParams.get('reviewed');
    const category = searchParams.get('category');
    const period = searchParams.get('period');

    const documents = await listDocuments({ reviewed, category, period });
    console.log('[API] Documentos carregados:', documents.length);

    return NextResponse.json({ documents });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar documento:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar documento' },
      { status: 500 }
    );
  }
});
