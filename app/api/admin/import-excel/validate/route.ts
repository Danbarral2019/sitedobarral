import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { processExcelFile } from '@/lib/excel-processor';

/**
 * POST /api/admin/import-excel/validate
 * Valida arquivo Excel e retorna preview dos documentos
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo fornecido' },
        { status: 400 }
      );
    }

    // Verifica se é arquivo Excel
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Formato de arquivo inválido. Use .xlsx ou .xls' },
        { status: 400 }
      );
    }

    // Converte para buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Processa o arquivo
    const result = await processExcelFile(buffer);

    return NextResponse.json({
      success: true,
      validation: result
    });
  } catch (error) {
    console.error('Erro ao validar Excel:', error);
    return NextResponse.json(
      { error: 'Erro ao processar arquivo Excel' },
      { status: 500 }
    );
  }
});
