import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { generateExcelTemplate } from '@/lib/excel-processor';

/**
 * GET /api/admin/import-excel/template
 * Gera e retorna template Excel para download
 */
export const GET = withAdminApi(async () => {
  // Gera o template
  const buffer = generateExcelTemplate();

  // Converte Buffer para Uint8Array (compatível com NextResponse)
  const uint8Array = new Uint8Array(buffer);

  // Retorna como arquivo para download
  return new NextResponse(uint8Array, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="template-importacao-documentos.xlsx"`,
      'Content-Length': buffer.length.toString()
    }
  });
});
