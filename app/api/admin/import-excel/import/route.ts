import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { processExcelFile } from '@/lib/excel-processor';
import { addDocument } from '@/lib/documents';

/**
 * POST /api/admin/import-excel/import
 * Importa documentos do Excel para o banco de dados
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo fornecido' },
        { status: 400 }
      );
    }

    // Converte para buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Processa o arquivo
    const validation = await processExcelFile(buffer);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Arquivo contém erros',
          validation
        },
        { status: 400 }
      );
    }

    // Importa apenas documentos válidos
    const validDocs = validation.documents.filter(doc => doc.isValid);
    const results = {
      total: validDocs.length,
      imported: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const doc of validDocs) {
      try {
        // Determina o tipo do documento
        let fileType: 'pdf' | 'doc' | 'link' | 'video' = 'link';

        if (doc.fileName) {
          const ext = doc.fileName.split('.').pop()?.toLowerCase();
          if (ext === 'pdf') fileType = 'pdf';
          else if (['doc', 'docx'].includes(ext || '')) fileType = 'doc';
          else if (['mp4', 'avi', 'mov'].includes(ext || '')) fileType = 'video';
        }

        // URL padrão se não fornecida
        const url = doc.url || doc.fileName || '#';

        // Se for múltiplos cursos, cria um documento para cada curso
        if (doc.isMultipleCourses && doc.courseIds && doc.courseIds.length > 0) {
          for (const courseId of doc.courseIds) {
            await addDocument(
              courseId,
              doc.title,
              doc.description,
              fileType,
              doc.category,
              doc.isPublic,
              url,
              undefined, // size (será null)
              doc.tags,
              doc.leiArticles
            );
          }
          results.imported += doc.courseIds.length;
        } else {
          // Curso único - comportamento original
          await addDocument(
            doc.courseId || '1',
            doc.title,
            doc.description,
            fileType,
            doc.category,
            doc.isPublic,
            url,
            undefined, // size (será null)
            doc.tags,
            doc.leiArticles
          );
          results.imported++;
        }
      } catch (error) {
        console.error(`Erro ao importar documento "${doc.title}":`, error);
        results.failed++;
        results.errors.push(
          `Falha ao importar "${doc.title}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      results,
      validation
    });
  } catch (error) {
    console.error('Erro ao importar Excel:', error);
    return NextResponse.json(
      { error: 'Erro ao importar arquivo Excel' },
      { status: 500 }
    );
  }
});
