import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { verifyAdmin } from '@/lib/api-middleware';

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
export async function POST(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const body = await request.json().catch(() => ({}));
  const { path, tag, type } = body as {
    path?: string;
    tag?: string;
    type?: 'layout' | 'page';
  };

  if (!path && !tag) {
    return NextResponse.json(
      { error: 'Forneça "path" (ex: "/base-conhecimento") ou "tag".' },
      { status: 400 }
    );
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

  console.log('[Admin Revalidate]', revalidated);

  return NextResponse.json({ success: true, revalidated });
}
