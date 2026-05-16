import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { generateExcelTemplate } from '@/lib/excel-processor';
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/admin/import-excel/template
 * Gera e retorna template Excel para download
 */
export const GET = withAdminAuth(async () => {
  try {
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
  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao gerar template:');
    return NextResponse.json(
      { error: 'Erro ao gerar template Excel' },
      { status: 500 }
    );
  }
});
