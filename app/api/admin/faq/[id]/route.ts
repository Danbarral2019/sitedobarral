import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { deleteFAQ, toggleFAQPublish } from '@/lib/faq';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    await deleteFAQ(id);
    // Invalidate FAQ cache
    await CacheInvalidation.faq();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return NextResponse.json({ error: 'Failed to delete FAQ' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();
    const { isPublished } = body;
    await toggleFAQPublish(id, isPublished);
    // Invalidate FAQ cache
    await CacheInvalidation.faq();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error toggling FAQ publish status:', error);
    return NextResponse.json({ error: 'Failed to toggle FAQ publish status' }, { status: 500 });
  }
}
