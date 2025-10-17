import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { addDocument } from '@/lib/documents';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const courseId = formData.get('courseId') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const isPublic = formData.get('isPublic') === 'true';
    const tags = formData.get('tags') as string;

    if (!file || !courseId || !title || !category) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos' },
        { status: 400 }
      );
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

    // Gera nome único para o arquivo
    const uniqueId = randomBytes(8).toString('hex');
    const fileName = `${uniqueId}-${file.name}`;

    // Define o caminho de upload
    const uploadDir = join(process.cwd(), 'public', 'uploads', courseId);
    const filePath = join(uploadDir, fileName);

    // Cria o diretório se não existir
    await mkdir(uploadDir, { recursive: true });

    // Salva o arquivo
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // URL relativa do arquivo
    const fileUrl = `/uploads/${courseId}/${fileName}`;

    // Adiciona documento ao sistema
    const document = await addDocument(
      courseId,
      title,
      description || '',
      fileType,
      category as any,
      isPublic,
      fileUrl,
      file.size,
      tags ? tags.split(',').map(t => t.trim()) : []
    );

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer upload do arquivo' },
      { status: 500 }
    );
  }
});
