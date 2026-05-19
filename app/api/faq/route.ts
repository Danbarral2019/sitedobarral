import { NextRequest, NextResponse } from 'next/server';
import { listPublishedFAQs } from '@/lib/faq/queries';
import { handleApiError } from '@/lib/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const category = params.get('category')?.trim() || undefined;
    const search = params.get('search')?.trim() || undefined;

    const groups = await listPublishedFAQs({ category, search });
    return NextResponse.json({ groups });
  } catch (error) {
    return handleApiError(error);
  }
}
