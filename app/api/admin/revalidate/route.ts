import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';

/**
 * POST /api/admin/revalidate
 *
 * Invalida o ISR do Next pra um path ou tag específicos. Útil quando dados
 * mudam fora do fluxo normal de UI (scripts CLI, importações em massa) e
 * o `revalidate=N` da página ainda está válido.
 *
 * Body: { path?: string; tag?: string; type?: 'layout' | 'page' }
 *
 * Exemplos:
 *   { "path": "/base-conhecimento" }
 *   { "path": "/base-conhecimento/enunciados" }
 *   { "tag": "documents" }
 */
export const POST = withAdminApi(async (request: NextRequest, ctx) => {
  const body = await request.json().catch(() => ({}));
  const { path, tag, type } = body as {
    path?: string;
    tag?: string;
    type?: 'layout' | 'page';
  };

  if (!path && !tag) {
    throw new ValidationError('Forneça "path" (ex: "/base-conhecimento") ou "tag".');
  }

  const revalidated: { paths: string[]; tags: string[] } = { paths: [], tags: [] };

  if (path) {
    revalidatePath(path, type);
    revalidated.paths.push(path);
  }
  if (tag) {
    revalidateTag(tag);
    revalidated.tags.push(tag);
  }

  ctx.logger.info({ revalidated }, 'Admin revalidate');

  return NextResponse.json({ success: true, revalidated });
});
