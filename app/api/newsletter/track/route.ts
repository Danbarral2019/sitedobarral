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
 *
 * Click tracking was removed to avoid security software (Trend Micro, etc.)
 * blocking redirect URLs. Clicks are now tracked via Resend webhooks.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  const type = searchParams.get('type');

  if (!id || type !== 'open') {
    return new NextResponse(TRANSPARENT_GIF, {
      status: 200,
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    });
  }

  try {
    await prisma.newsletterSend.update({
      where: { id },
      data: { opens: { increment: 1 } },
    });
  } catch {
    // Silently ignore tracking errors (e.g. invalid sendId)
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
  });
}
