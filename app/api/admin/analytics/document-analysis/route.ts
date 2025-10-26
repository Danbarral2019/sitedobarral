/**
 * API endpoint para analytics de análises automáticas de documentos
 *
 * GET /api/admin/analytics/document-analysis
 * Retorna estatísticas agregadas e análises recentes
 */

import { NextResponse } from 'next/server';
import { getAnalyticsStats, getRecentAnalyses } from '@/lib/analytics-tracker';

export async function GET() {
  try {
    // Busca estatísticas e análises recentes em paralelo
    const [stats, recentAnalyses] = await Promise.all([
      getAnalyticsStats(),
      getRecentAnalyses(20)
    ]);

    return NextResponse.json({
      success: true,
      stats,
      recentAnalyses
    });

  } catch (error) {
    console.error('Erro ao buscar analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar analytics'
      },
      { status: 500 }
    );
  }
}
