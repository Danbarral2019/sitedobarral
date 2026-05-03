import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_BULK_IDS = 20;

export async function POST(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '');
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : [];
  const reason = String(body?.reason || '').trim() || undefined;

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action deve ser approve ou reject' }, { status: 422 });
  }
  if (ids.length === 0 || ids.length > MAX_BULK_IDS) {
    return NextResponse.json({ error: `ids deve ter entre 1 e ${MAX_BULK_IDS}` }, { status: 422 });
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
}
