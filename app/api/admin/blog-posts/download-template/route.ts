import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/api-error';
import path from 'path';
import fs from 'fs/promises';

export const GET = withAdminApi(async () => {
  const templatePath = path.join(process.cwd(), 'public', 'templates', 'template-artigo-blog.docx');

  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.readFile(templatePath);
  } catch {
    throw new NotFoundError('Template');
  }

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="template-artigo-blog.docx"',
    },
  });
});
