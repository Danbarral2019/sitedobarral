import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/logger';

// sendId é um UUID (ou 'dry-run'); qualquer outra coisa não vai para o log
const SEND_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export async function GET(request: NextRequest) {
  const sendId = request.nextUrl.searchParams.get('send');
  if (sendId && SEND_ID_PATTERN.test(sendId)) {
    apiLogger.info({ sendId }, '[Clipping] Open tracked');
  }
  return new NextResponse(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
    },
  });
}
