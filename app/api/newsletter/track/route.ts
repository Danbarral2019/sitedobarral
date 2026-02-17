import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 1x1 transparent GIF pixel
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * Newsletter Tracking Endpoint
 * - type=open: increment opens, return 1x1 transparent GIF
 * - type=click: increment clicks, redirect 302 to url
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  const type = searchParams.get('type');
  const url = searchParams.get('url');

  if (!id || !type) {
    return new NextResponse(TRANSPARENT_GIF, {
      status: 200,
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    });
  }

  try {
    if (type === 'open') {
      await prisma.newsletterSend.update({
        where: { id },
        data: { opens: { increment: 1 } },
      });

      return new NextResponse(TRANSPARENT_GIF, {
        status: 200,
        headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
      });
    }

    if (type === 'click' && url) {
      await prisma.newsletterSend.update({
        where: { id },
        data: { clicks: { increment: 1 } },
      });

      return NextResponse.redirect(url, 302);
    }
  } catch {
    // Silently ignore tracking errors (e.g. invalid sendId)
  }

  // Fallback: return pixel for open, redirect to homepage for click
  if (type === 'click' && url) {
    return NextResponse.redirect(url, 302);
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
  });
}
