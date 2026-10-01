import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { generateExcelTemplate } from '@/lib/excel-processor';

/**
 * GET /api/admin/import-excel/template
 * Gera e retorna template Excel para download
 */
export const GET = withAdminApi(async () => {
  // Gera o template
  const buffer = await generateExcelTemplate();

  // Retorna como arquivo para download
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="template-importacao-documentos.xlsx"`,
      'Content-Length': buffer.length.toString()
    }
  });
});
