import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { listAllFAQs } from '@/lib/faq/queries';

const CreateFAQSchema = z.object({
  question: z.string().min(3).max(500),
  answer: z.string().min(5),
  category: z.string().min(1).max(80),
  displayOrder: z.number().int().min(0).default(0),
  isPinned: z.boolean().default(false),
  isPublished: z.boolean().default(true),
  keywords: z.string().max(500).nullable().optional(),
});

export const GET = withAdminApi(async () => {
  const faqs = await listAllFAQs();
  return NextResponse.json({ faqs });
});

export const POST = withAdminApi(async (request: NextRequest) => {
  const body = await request.json().catch(() => ({}));
  const parsed = CreateFAQSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const faq = await prisma.fAQ.create({ data: parsed.data });
  return NextResponse.json({ faq }, { status: 201 });
});
