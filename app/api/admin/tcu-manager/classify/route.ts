import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import {
  classifyTCUAcordaosBatch,
  type TCUClassificationInput,
  type TCUClassificationResult,
} from '@/lib/tcu-classifier';

/**
 * POST /api/admin/tcu-manager/classify
 * Classifica documentos TCU usando IA contextualizada
 *
 * Body: {
 *   documents: Array<{
 *     tcuData: TCUPlanilhaData,
 *     enrichment?: TCUEnrichmentResult,
 *     rowIndex: number
 *   }>
 * }
 *
 * Response: {
 *   success: boolean,
 *   results: Array<{
 *     rowIndex: number,
 *     classification: TCUClassificationResult
 *   }>,
 *   stats: {
 *     total: number,
 *     classified: number,
 *     failed: number,
 *     avgConfianca: number
 *   }
 * }
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { documents } = body;

    if (!Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { error: 'Array de documentos vazio ou inválido' },
        { status: 400 }
      );
    }

    console.log(`[TCU Classify API] Iniciando classificação de ${documents.length} documentos`);

    // Prepara inputs para classificação
    const inputs: TCUClassificationInput[] = documents.map(doc => ({
      planilha: doc.tcuData,
      enrichment: doc.enrichment,
    }));

    const rowIndexes: number[] = documents.map(doc => doc.rowIndex);

    // Classifica em lote com progresso
    let processedCount = 0;
    const classificationResults = await classifyTCUAcordaosBatch(inputs, {
      delayMs: 2000, // 2 segundos entre requisições (API do Claude tem rate limit)
      onProgress: (current, total, result) => {
        processedCount = current;
        console.log(`[TCU Classify API] Progresso: ${current}/${total} (${Math.round(current / total * 100)}%)`);
      },
    });

    // Combina resultados com índices das linhas
    const results = classificationResults.map((classification, index) => ({
      rowIndex: rowIndexes[index],
      classification,
    }));

    // Estatísticas
    const successResults = results.filter(r => r.classification.success);
    const totalConfianca = successResults.reduce((sum, r) => sum + r.classification.confianca, 0);

    const stats = {
      total: results.length,
      classified: successResults.length,
      failed: results.filter(r => !r.classification.success).length,
      avgConfianca: successResults.length > 0 ? Math.round(totalConfianca / successResults.length) : 0,
    };

    console.log(`[TCU Classify API] Concluído:`, stats);

    return NextResponse.json({
      success: true,
      results,
      stats,
    });

  } catch (error) {
    console.error('[TCU Classify API] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro ao classificar documentos',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
});
