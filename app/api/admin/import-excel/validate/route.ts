import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import { processExcelFile, validateWorkbookUpload } from '@/lib/excel-processor';

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

  validateWorkbookUpload({ filename: file.name, mimeType: file.type, size: file.size });

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
