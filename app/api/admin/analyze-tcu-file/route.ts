import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import * as xlsx from 'xlsx';

/**
 * POST /api/admin/analyze-tcu-file
 * Analisa estrutura de arquivo TCU (temporário para debug)
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    console.log('[Analyze TCU] Processando:', file.name);

    // Converte file para buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Lê o Excel
    const workbook = xlsx.read(buffer, {
      type: 'buffer',
      cellDates: true,
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Converte para JSON
    const data = xlsx.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

    console.log(`[Analyze TCU] Total de linhas: ${data.length}`);

    if (data.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Planilha vazia',
        sheets: workbook.SheetNames,
        totalRows: 0,
        columns: [],
        sample: [],
      });
    }

    // Pega colunas
    const columns = Object.keys(data[0]);

    // Primeiros 5 registros
    const sample = data.slice(0, 5);

    // Estatísticas
    const stats = {
      total: data.length,
      columns: columns.length,
      comEnunciado: data.filter(r => r['Enunciado'] || r['enunciado']).length,
      comAcordao: data.filter(r => r['Acordao'] || r['acordao'] || r['Acórdão']).length,
      comArea: data.filter(r => r['Area'] || r['area'] || r['Área']).length,
    };

    return NextResponse.json({
      success: true,
      message: 'Análise concluída',
      sheets: workbook.SheetNames,
      totalRows: data.length,
      columns,
      sample,
      stats,
    });

  } catch (error) {
    console.error('[Analyze TCU] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro ao analisar arquivo',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
});
