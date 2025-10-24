import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import path from 'path';
import fs from 'fs/promises';

export const GET = withAdminAuth(async () => {
  try {
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'template-artigo-blog.txt');

    // Ler o arquivo
    const fileBuffer = await fs.readFile(templatePath);

    // Retornar como download
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="template-artigo-blog.txt"',
      },
    });
  } catch (error) {
    console.error('[DownloadTemplate] Erro:', error);
    return NextResponse.json(
      { error: 'Template não encontrado. Use o arquivo em public/templates/template-artigo-blog.txt' },
      { status: 404 }
    );
  }
});
