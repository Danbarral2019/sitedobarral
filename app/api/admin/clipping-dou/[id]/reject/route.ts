import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = String(body?.reason || '').trim().substring(0, 1000) || null;

  const staging = await prisma.dOUStagingDocument.findUnique({ where: { id } });
  if (!staging) return NextResponse.json({ error: 'Staging não encontrado' }, { status: 404 });
  if (staging.finalDecision) {
    return NextResponse.json({ error: `Já ${staging.finalDecision}` }, { status: 409 });
  }

  await prisma.dOUStagingDocument.update({
    where: { id },
    data: {
      finalDecision: 'rejected',
      reviewedAt: new Date(),
      reviewedBy: adminCheck.user.email,
      adminNotes: reason,
      classificationCorrect: false,
    },
  });

  return NextResponse.json({ success: true });
}
