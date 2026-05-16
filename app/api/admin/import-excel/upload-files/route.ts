import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { updateDocument } from '@/lib/documents';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/admin/import-excel/upload-files
 * Faz upload em lote de arquivos e faz matching com documentos existentes
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum arquivo fornecido' },
        { status: 400 }
      );
    }

    const results = {
      total: files.length,
      matched: 0,
      uploaded: 0,
      notMatched: [] as string[],
      errors: [] as string[],
      matchedDetails: [] as Array<{
        fileName: string;
        documentId: string;
        documentTitle: string;
      }>,
    };

    for (const file of files) {
      try {
        const originalFileName = file.name;
        const normalizedFileName = originalFileName.toLowerCase().trim();

        // Busca documentos que tenham o nome do arquivo no campo 'url'
        // Pode ser exato ou parte do nome
        const matchingDocuments = await prisma.document.findMany({
          where: {
            OR: [
              { url: normalizedFileName },
              { url: { contains: normalizedFileName } },
              { url: { contains: originalFileName } },
            ],
          },
        });

        if (matchingDocuments.length === 0) {
          results.notMatched.push(originalFileName);
          continue;
        }

        // Pega o primeiro documento que deu match
        const document = matchingDocuments[0];
        results.matched++;

        // Determina o tipo do arquivo
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        let fileType: 'pdf' | 'doc' | 'link' | 'video' = 'doc';

        if (fileExtension === 'pdf') {
          fileType = 'pdf';
        } else if (['mp4', 'avi', 'mov', 'wmv'].includes(fileExtension || '')) {
          fileType = 'video';
        } else if (['doc', 'docx'].includes(fileExtension || '')) {
          fileType = 'doc';
        }

        // Gera nome único para o arquivo
        const uniqueId = randomBytes(8).toString('hex');
        const fileName = `${uniqueId}-${file.name}`;

        // Define o caminho de upload
        const uploadDir = join(process.cwd(), 'public', 'uploads', document.courseId || 'common');
        const filePath = join(uploadDir, fileName);

        // Cria o diretório se não existir
        await mkdir(uploadDir, { recursive: true });

        // Salva o arquivo
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // URL relativa do arquivo
        const fileUrl = `/uploads/${document.courseId || 'common'}/${fileName}`;

        // Atualiza o documento com a nova URL e tamanho
        await updateDocument(document.id, {
          url: fileUrl,
          size: file.size,
          type: fileType,
        });

        results.uploaded++;
        results.matchedDetails.push({
          fileName: originalFileName,
          documentId: document.id,
          documentTitle: document.title,
        });
      } catch (error) {
        apiLogger.error({ err: error }, `Erro ao processar arquivo "${file.name}":`);
        results.errors.push(
          `Erro ao processar "${file.name}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        );
      }
    }

    return NextResponse.json({
      success: results.errors.length === 0,
      results,
    });
  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao fazer upload em lote:');
    return NextResponse.json(
      { error: 'Erro ao processar upload em lote' },
      { status: 500 }
    );
  }
});
