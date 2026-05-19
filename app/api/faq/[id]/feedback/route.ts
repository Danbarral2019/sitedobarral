import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError, ValidationError } from '@/lib/errors/api-error';
import { getClientIp } from '@/lib/cache/rate-limit-helper';

const FeedbackSchema = z.object({
  wasHelpful: z.boolean(),
  comment: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const parsed = FeedbackSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Feedback inválido', parsed.error.issues);
    }

    const faq = await prisma.fAQ.findUnique({ where: { id }, select: { id: true } });
    if (!faq) throw new NotFoundError('FAQ');

    const ip = getClientIp(request);
    await prisma.$transaction([
      prisma.fAQFeedback.create({
        data: {
          faqId: id,
          wasHelpful: parsed.data.wasHelpful,
          comment: parsed.data.comment || null,
          ip,
        },
      }),
      prisma.fAQ.update({
        where: { id },
        data: parsed.data.wasHelpful
          ? { helpfulCount: { increment: 1 } }
          : { notHelpfulCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
