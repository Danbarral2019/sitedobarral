import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import {
  enrichTCUAcordaosBatch,
  type TCUPlanilhaData,
} from '@/lib/tcu-scraper';
import { ValidationError } from '@/lib/errors/api-error';

/**
 * POST /api/admin/tcu-manager/enrich
 * Enriquece documentos da planilha TCU buscando dados adicionais
 *
 * Body: {
 *   documents: Array<{
 *     tcuData: TCUPlanilhaData,
 *     rowIndex: number
 *   }>
 * }
 *
 * Response: {
 *   success: boolean,
 *   results: Array<{
 *     rowIndex: number,
 *     enrichment: TCUEnrichmentResult
 *   }>,
 *   stats: {
 *     total: number,
 *     enriched: number,
 *     failed: number
 *   }
 * }
 */
export const POST = withAdminApi(async (request: NextRequest) => {
  const body = await request.json();
  const { documents } = body;

  if (!Array.isArray(documents) || documents.length === 0) {
    throw new ValidationError('Array de documentos vazio ou inválido');
  }

  console.log(`[TCU Enrich API] Iniciando enriquecimento de ${documents.length} documentos`);

  // Extrai dados da planilha de cada documento
  const planilhaDataList: TCUPlanilhaData[] = documents.map(doc => doc.tcuData);
  const rowIndexes: number[] = documents.map(doc => doc.rowIndex);

  // Enriquece em lote com progresso
  const enrichmentResults = await enrichTCUAcordaosBatch(planilhaDataList, {
    delayMs: 1000, // 1 segundo entre requisições
    maxConcurrent: 3, // Máximo 3 requisições simultâneas
    onProgress: (current, total) => {
      console.log(`[TCU Enrich API] Progresso: ${current}/${total} (${Math.round(current / total * 100)}%)`);
    },
  });

  // Combina resultados com índices das linhas
  const results = enrichmentResults.map((enrichment, index) => ({
    rowIndex: rowIndexes[index],
    enrichment,
  }));

  // Estatísticas
  const stats = {
    total: results.length,
    enriched: results.filter(r => r.enrichment.success).length,
    failed: results.filter(r => !r.enrichment.success).length,
  };

  console.log(`[TCU Enrich API] Concluído:`, stats);

  return NextResponse.json({
    success: true,
    results,
    stats,
  });
});
