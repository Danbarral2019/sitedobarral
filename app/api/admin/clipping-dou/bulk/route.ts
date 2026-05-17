import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError } from '@/lib/errors/api-error';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_BULK_IDS = 20;

export const POST = withAdminApi(async (request) => {
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '');
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : [];
  const reason = String(body?.reason || '').trim() || undefined;

  if (action !== 'approve' && action !== 'reject') {
    throw new ApiError(422, 'action deve ser approve ou reject', 'VALIDATION_ERROR');
  }
  if (ids.length === 0 || ids.length > MAX_BULK_IDS) {
    throw new ApiError(422, `ids deve ter entre 1 e ${MAX_BULK_IDS}`, 'VALIDATION_ERROR');
  }

  // Reusa endpoints individuais sequencialmente (não satura Gemini/scraper)
  const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const id of ids) {
    const path = action === 'approve'
      ? `/api/admin/clipping-dou/${id}/approve`
      : `/api/admin/clipping-dou/${id}/reject`;
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Repassa cookies de sessão
          cookie: request.headers.get('cookie') || '',
        },
        body: action === 'reject' && reason ? JSON.stringify({ reason }) : '{}',
      });
      results.push({ id, ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` });
    } catch (e) {
      results.push({ id, ok: false, error: (e as Error).message });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ success: true, action, processed: ids.length, ok: okCount, results });
});
