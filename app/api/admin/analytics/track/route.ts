/**
 * API endpoint para rastrear análises de documentos
 *
 * POST /api/admin/analytics/track
 * Salva registro de análise com sugestões e artigos aceitos
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { trackAnalysis } from '@/lib/analytics-tracker';
import type { ArticleSuggestion } from '@/lib/document-analyzer';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();

    const {
      documentTitle,
      documentType,
      textLength,
      pageCount,
      citationsFound,
      keywordsMatched,
      suggestions,
      acceptedArticles,
    } = body;

    // Validação
    if (!documentTitle || !suggestions || !Array.isArray(suggestions)) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    // Salva análise
    const result = await trackAnalysis({
      documentTitle,
      documentType,
      textLength: textLength || 0,
      pageCount,
      citationsFound: citationsFound || 0,
      keywordsMatched: keywordsMatched || 0,
      suggestions: suggestions as ArticleSuggestion[],
      acceptedArticles: acceptedArticles || [],
      userId: authResult.user!.userId
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Erro ao salvar análise' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erro ao rastrear análise:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao rastrear análise'
      },
      { status: 500 }
    );
  }
}
