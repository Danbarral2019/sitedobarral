import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { addDocument } from '@/lib/documents';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { courses } from '@/data/courses';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { ValidationError } from '@/lib/errors/api-error';
import { apiLogger } from "@/lib/logger";

export const POST = withAdminApi(async (request: NextRequest) => {
    const ip = getClientIp(request);
    await enforceRateLimit(`upload:${ip}`, 10, 60);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const courseId = formData.get('courseId') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const content = formData.get('content') as string | null;
    const category = formData.get('category') as string;
    const isPublic = formData.get('isPublic') === 'true';
    const tags = formData.get('tags') as string;
    const leiArticles = formData.get('leiArticles') as string;
    const entityType = formData.get('entityType') as string | null;
    const enunciadoNumber = formData.get('enunciadoNumber') as string | null;

    if (!file || !courseId || !title || !category) {
      throw new ValidationError('Parâmetros inválidos');
    }

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

    // Verifica se é para todos os cursos
    const isAllCourses = courseId.toUpperCase() === 'TODOS' || courseId === '*';
    const targetCourses = isAllCourses
      ? courses.map(c => c.id)
      : [courseId];

    const createdDocuments = [];

    // Gera nome único para o arquivo
    const uniqueId = randomBytes(8).toString('hex');
    const fileName = `${uniqueId}-${file.name}`;

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

      // Adiciona documento ao sistema
      const document = await addDocument(
        targetCourseId,
        title,
        description || '',
        fileType,
        category as "apostila" | "acordao" | "parecer" | "edital" | "artigo" | "orientacao-normativa" | "enunciados" | "outro",
        isPublic,
        fileUrl,
        file.size,
        tags ? tags.split(',').map(t => t.trim()) : [],
        leiArticles ? JSON.parse(leiArticles) : [],
        undefined, // alternativeUrls
        undefined, // onNumber
        undefined, // onYear
        entityType || undefined, // entityType para enunciados
        enunciadoNumber || undefined, // enunciadoNumber para enunciados
        undefined, // notes
        content || undefined // content para busca textual
      );

      createdDocuments.push(document);
    }

    return NextResponse.json({
      success: true,
      document: createdDocuments[0], // Primeiro documento para compatibilidade
      documents: createdDocuments, // Todos os documentos criados
      count: createdDocuments.length,
      isAllCourses,
    });
});
