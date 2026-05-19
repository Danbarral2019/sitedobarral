import { NextRequest, NextResponse } from 'next/server';
import { getFAQById, incrementFAQViewCount } from '@/lib/faq/queries';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const faq = await getFAQById(id);
    if (!faq || !faq.isPublished) throw new NotFoundError('FAQ');

    // Fire-and-forget view count (não bloqueia resposta)
    incrementFAQViewCount(id).catch(() => {});

    return NextResponse.json({ faq });
  } catch (error) {
    return handleApiError(error);
  }
}
