import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { listDocuments, deleteDocument } from '@/lib/documents';

// GET - Lista todos os documentos
export const GET = withAdminAuth(async () => {
  try {
    const documents = await listDocuments();

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Erro ao listar documentos:', error);
    return NextResponse.json(
      { error: 'Erro ao listar documentos' },
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
