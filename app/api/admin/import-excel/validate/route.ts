import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import { processExcelFile } from '@/lib/excel-processor';

/**
 * POST /api/admin/import-excel/validate
 * Valida arquivo Excel e retorna preview dos documentos
 */
export const POST = withAdminApi(async (request) => {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    throw new ValidationError('Nenhum arquivo fornecido');
  }

  // Verifica se é arquivo Excel
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
    throw new ValidationError('Formato de arquivo inválido. Use .xlsx ou .xls');
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
});
