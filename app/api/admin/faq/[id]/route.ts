import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';

const UpdateFAQSchema = z.object({
  question: z.string().min(3).max(500).optional(),
  answer: z.string().min(5).optional(),
  category: z.string().min(1).max(80).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isPinned: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  keywords: z.string().max(500).nullable().optional(),
});

export const PUT = withAdminApi<{ id: string }>(async (request: NextRequest, ctx) => {
  const body = await request.json().catch(() => ({}));
  const parsed = UpdateFAQSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const faq = await prisma.fAQ.update({
    where: { id: ctx.params.id },
    data: parsed.data,
  });
  return NextResponse.json({ faq });
});

export const DELETE = withAdminApi<{ id: string }>(async (_request: NextRequest, ctx) => {
  await prisma.fAQ.delete({ where: { id: ctx.params.id } });
  return NextResponse.json({ success: true });
});
