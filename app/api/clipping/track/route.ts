import { NextRequest, NextResponse } from 'next/server';

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export async function GET(request: NextRequest) {
  const sendId = request.nextUrl.searchParams.get('send');
  if (sendId) {
    console.log(`[Clipping] Open tracked: send=${sendId}`);
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
