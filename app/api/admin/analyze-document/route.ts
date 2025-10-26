import { NextRequest, NextResponse } from 'next/server';
import { analyzeDocument, analyzeMetadata } from '@/lib/document-analyzer';

/**
 * POST /api/admin/analyze-document
 *
 * Analisa um documento e sugere artigos da Lei 14.133/2021 para catalogação
 *
 * Aceita dois modos:
 * 1. Análise de arquivo (multipart/form-data com campo 'file')
 * 2. Análise de metadados (JSON com 'title' e 'description')
 *
 * Returns: { success, suggestions, stats }
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Modo 1: Análise de arquivo (upload)
    if (contentType.includes('multipart/form-data')) {
      return await analyzeFile(request);
    }

    // Modo 2: Análise de metadados (título + descrição)
    if (contentType.includes('application/json')) {
      return await analyzeMetadataEndpoint(request);
    }

    return NextResponse.json(
      { error: 'Content-Type inválido. Use multipart/form-data ou application/json' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Erro ao analisar documento:', error);
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    );
  }
}

/**
 * Analisa arquivo enviado
 */
async function analyzeFile(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo foi enviado' },
        { status: 400 }
      );
    }

    // Valida tipo de arquivo
    const supportedTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (!supportedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Tipo de arquivo não suportado: ${file.type}`,
          supportedTypes
        },
        { status: 400 }
      );
    }

    // Converte arquivo para Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Analisa documento
    const result = await analyzeDocument(buffer, file.type);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Erro ao analisar documento',
          warning: result.error?.includes('não implementada')
            ? 'Esta funcionalidade requer instalação de bibliotecas adicionais. Por enquanto, use a análise de metadados.'
            : undefined
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Erro ao processar arquivo:', error);
    return NextResponse.json(
      { error: 'Erro ao processar arquivo' },
      { status: 500 }
    );
  }
}

/**
 * Analisa apenas título e descrição (sem arquivo)
 */
async function analyzeMetadataEndpoint(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Campo "title" é obrigatório' },
        { status: 400 }
      );
    }

    const suggestions = await analyzeMetadata(
      title,
      description || ''
    );

    return NextResponse.json({
      success: true,
      suggestions,
      stats: {
        textLength: title.length + (description?.length || 0),
        citationsFound: suggestions.filter(s =>
          s.sources.some(src => src.type === 'citation')
        ).length,
        keywordsMatched: suggestions.filter(s =>
          s.sources.some(src => src.type === 'keyword')
        ).length,
        totalSuggestions: suggestions.length
      }
    });

  } catch (error) {
    console.error('Erro ao analisar metadados:', error);
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    );
  }
}
