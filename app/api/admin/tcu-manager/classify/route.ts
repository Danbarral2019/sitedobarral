import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import {
  classifyTCUAcordaosBatch,
  type TCUClassificationInput,
} from '@/lib/tcu-classifier';
import { ValidationError } from '@/lib/errors/api-error';

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
export const POST = withAdminApi(async (request: NextRequest) => {
  const body = await request.json();
  const { documents } = body;

  if (!Array.isArray(documents) || documents.length === 0) {
    throw new ValidationError('Array de documentos vazio ou inválido');
  }

  console.log(`[TCU Classify API] Iniciando classificação de ${documents.length} documentos`);

  // Prepara inputs para classificação
  const inputs: TCUClassificationInput[] = documents.map(doc => ({
    planilha: doc.tcuData,
    enrichment: doc.enrichment,
  }));

  const rowIndexes: number[] = documents.map(doc => doc.rowIndex);

  // Classifica em lote com progresso
  const classificationResults = await classifyTCUAcordaosBatch(inputs, {
    delayMs: 500, // 0.5 segundos entre requisições (lotes pequenos = menos risco de rate limit)
    onProgress: (current, total) => {
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
});
