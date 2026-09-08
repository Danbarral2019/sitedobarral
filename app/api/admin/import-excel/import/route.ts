import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import { processExcelFile, validateWorkbookUpload } from '@/lib/excel-processor';
import { addDocument } from '@/lib/documents';
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/admin/import-excel/import
 * Importa documentos do Excel para o banco de dados
 */
export const POST = withAdminApi(async (request: NextRequest) => {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new ValidationError('Nenhum arquivo fornecido');
    }

    validateWorkbookUpload({ filename: file.name, mimeType: file.type, size: file.size });

    // Converte para buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Processa o arquivo
    const validation = await processExcelFile(buffer);

    if (!validation.isValid) {
      throw new ValidationError('Arquivo contém erros', { validation });
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
            doc.courseId || '2',
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
        apiLogger.error({ err: error }, `Erro ao importar documento "${doc.title}":`);
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
});
