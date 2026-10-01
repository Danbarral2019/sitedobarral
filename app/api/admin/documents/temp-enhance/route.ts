import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { wizardEnhance } from '@/lib/ai/wizard-enhance';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, ValidationError } from '@/lib/errors/api-error';

/**
 * POST /api/admin/documents/temp-enhance
 *
 * Enriquece documento temporário (sem ID) com IA durante criação no wizard.
 * Recebe título, descrição, categoria e retorna sugestões de IA.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      throw new AuthenticationError('Unauthorized');
    }

    const body = await request.json();
    const { title, description, category } = body;

    if (!title) {
      throw new ValidationError('Título é obrigatório');
    }

    console.log(`[Temp Enhance] Analisando: ${title}`);

    // 2. Chamar orquestrador (LeiIndexer + Claude editorial em paralelo).
    // Doc ainda não existe, sem extractedText — LeiIndexer opera só com title/category.
    const enhancement = await wizardEnhance({
      title,
      description: description || undefined,
      category: category || 'outro',
    });

    console.log(`[Temp Enhance] Sucesso (strategy: ${enhancement._meta.mergeStrategy}). Confiança: ${enhancement.confidence}%`);

    // 3. Retornar sugestões
    return NextResponse.json({
      success: true,
      enhancement: {
        summary: enhancement.summary,
        highlights: enhancement.highlights,
        keyPoints: enhancement.keyPoints.join('\n'), // String com 1 por linha
        practicalUse: enhancement.practicalUse,
        publicNotes: enhancement.publicNotes,
        suggestedImportance: enhancement.suggestedImportance,
        tags: enhancement.tags,
        leiArticles: enhancement.leiArticles,
        confidence: enhancement.confidence,
        reasoning: enhancement.reasoning,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
