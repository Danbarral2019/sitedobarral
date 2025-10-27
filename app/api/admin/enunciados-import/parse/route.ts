import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { parseEnunciadosPDF, classifyEnunciado } from '@/lib/enunciados-parser';

/**
 * POST /api/admin/enunciados-import/parse
 * Processa PDF de enunciados e extrai/classifica cada um
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const autoClassify = formData.get('autoClassify') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    // Aceita PDF e DOCX
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Apenas arquivos PDF e DOCX são suportados' },
        { status: 400 }
      );
    }

    console.log(`[Enunciados Import] Processando arquivo: ${file.name}, tamanho: ${file.size} bytes, tipo: ${file.type}`);

    // Converte File para Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extrai enunciados
    const parseResult = await parseEnunciadosPDF(buffer, file.name);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error || 'Erro ao processar PDF' },
        { status: 400 }
      );
    }

    console.log(`[Enunciados Import] ${parseResult.totalEnunciados} enunciados extraídos`);

    // Classifica automaticamente se solicitado (em lotes para evitar timeout)
    let enunciadosClassificados = parseResult.enunciados;

    if (autoClassify && parseResult.enunciados.length > 0) {
      console.log(`[Enunciados Import] Iniciando classificação IA de ${parseResult.enunciados.length} enunciados`);

      const classificacoes = [];

      // Processa em lotes de 3 enunciados para evitar timeout
      const BATCH_SIZE = 3;
      const DELAY_MS = 500; // 0.5 segundos entre enunciados

      for (let i = 0; i < parseResult.enunciados.length; i++) {
        const enunciado = parseResult.enunciados[i];

        console.log(`[Enunciados Import] Classificando ${i + 1}/${parseResult.enunciados.length}: ${enunciado.titulo}`);

        const classification = await classifyEnunciado(enunciado);

        classificacoes.push({
          ...enunciado,
          classification,
        });

        // Aguarda antes do próximo (exceto no último)
        if (i < parseResult.enunciados.length - 1) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }

      enunciadosClassificados = classificacoes;
      console.log(`[Enunciados Import] Classificação concluída: ${classificacoes.length} enunciados`);
    }

    return NextResponse.json({
      success: true,
      fonte: parseResult.fonte,
      totalEnunciados: parseResult.totalEnunciados,
      enunciados: enunciadosClassificados,
    });

  } catch (error) {
    console.error('[Enunciados Import] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro ao processar arquivo',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
});
