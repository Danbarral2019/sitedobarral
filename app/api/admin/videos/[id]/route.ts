import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { deleteCourseVideo } from '@/lib/videos';
import { apiLogger } from "@/lib/logger";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    await deleteCourseVideo(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    apiLogger.error({ err: error }, 'Error deleting video:');
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
  }
}
