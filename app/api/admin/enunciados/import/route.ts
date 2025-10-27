import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { courses } from '@/data/courses';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/enunciados/import
 * Importa enunciado em PDF e cria documento(s) automaticamente
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const entityType = formData.get('entityType') as string;
    const courseId = formData.get('courseId') as string;

    // Validações
    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    if (!entityType || !['IBDA', 'INCP', 'CJF'].includes(entityType)) {
      return NextResponse.json(
        { error: 'Entidade inválida' },
        { status: 400 }
      );
    }

    if (!courseId) {
      return NextResponse.json(
        { error: 'Curso não selecionado' },
        { status: 400 }
      );
    }

    // Verifica se o arquivo é PDF
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'pdf') {
      return NextResponse.json(
        { error: 'Apenas arquivos PDF são aceitos' },
        { status: 400 }
      );
    }

    // Determina os cursos-alvo
    const isAllCourses = courseId.toUpperCase() === 'TODOS' || courseId === '*';
    const targetCourses = isAllCourses
      ? courses.map(c => c.id)
      : [courseId];

    const createdDocuments = [];

    // Gera nome único para o arquivo
    const uniqueId = randomBytes(8).toString('hex');
    const fileName = `${uniqueId}-${file.name}`;

    // Nomes das entidades
    const entityNames: Record<string, string> = {
      'IBDA': 'Instituto Brasileiro de Direito Administrativo',
      'INCP': 'Instituto Nacional da Contratação Pública',
      'CJF': 'Conselho da Justiça Federal',
    };

    // Processa para cada curso
    for (const targetCourseId of targetCourses) {
      // Define o caminho de upload
      const uploadDir = join(process.cwd(), 'public', 'uploads', targetCourseId);
      const filePath = join(uploadDir, fileName);

      // Cria o diretório se não existir
      await mkdir(uploadDir, { recursive: true });

      // Salva o arquivo
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      // URL relativa do arquivo
      const fileUrl = `/uploads/${targetCourseId}/${fileName}`;

      // Cria documento no banco
      const document = await prisma.document.create({
        data: {
          title: `Enunciados ${entityNames[entityType]}`,
          description: `Compilação de enunciados do ${entityNames[entityType]}`,
          type: 'pdf',
          category: 'enunciados',
          courseId: targetCourseId,
          isPublic: false, // Enunciados são privados por padrão
          url: fileUrl,
          size: file.size,
          tags: JSON.stringify([entityType, 'Enunciados']),
          leiArticles: JSON.stringify([]), // Será preenchido pela IA posteriormente
          entityType: entityType,
          enunciadoNumber: null, // PDF compilado, sem número específico
          reviewed: false, // Precisa ser revisado
        },
      });

      createdDocuments.push(document);
    }

    // Análise automática com IA para sugerir artigos da Lei 14.133
    // (Apenas para o primeiro documento se houver múltiplos)
    try {
      const analyzeFormData = new FormData();
      analyzeFormData.append('file', file);

      const analyzeResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/analyze-document`, {
        method: 'POST',
        body: analyzeFormData,
      });

      if (analyzeResponse.ok) {
        const analyzeData = await analyzeResponse.json();

        if (analyzeData.success && analyzeData.suggestions && analyzeData.suggestions.length > 0) {
          // Pega artigos com alta confiança (score >= 8 ou confidence = 'high')
          const highConfidenceArticles = analyzeData.suggestions
            .filter((s: { confidence: string; score: number }) =>
              s.confidence === 'high' || s.score >= 8
            )
            .map((s: { articleNumber: string }) => s.articleNumber);

          // Atualiza TODOS os documentos criados com os artigos sugeridos
          if (highConfidenceArticles.length > 0) {
            await Promise.all(
              createdDocuments.map(doc =>
                prisma.document.update({
                  where: { id: doc.id },
                  data: {
                    leiArticles: JSON.stringify(highConfidenceArticles),
                    aiSuggestedArticles: JSON.stringify(analyzeData.suggestions),
                  },
                })
              )
            );

            console.log(`[Enunciados Import] ${highConfidenceArticles.length} artigos da Lei 14.133 sugeridos pela IA`);
          }
        }
      }
    } catch (error) {
      // Não falha a importação se a análise falhar
      console.error('[Enunciados Import] Erro ao analisar documento com IA:', error);
    }

    console.log(`[Enunciados Import] ${createdDocuments.length} documento(s) criado(s) com sucesso`);

    return NextResponse.json({
      success: true,
      documentId: createdDocuments[0].id, // ID do primeiro documento para edição
      documents: createdDocuments,
      count: createdDocuments.length,
      isAllCourses,
    });
  } catch (error) {
    console.error('[Enunciados Import] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao importar enunciado. Verifique o arquivo e tente novamente.' },
      { status: 500 }
    );
  }
});
