import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { deleteCourseVideo } from '@/lib/videos';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError } from '@/lib/errors/api-error';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      throw new AuthenticationError('Unauthorized');
    }
    const { id } = await params;
    await deleteCourseVideo(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
