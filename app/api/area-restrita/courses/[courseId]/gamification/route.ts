import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { getUserGamificationData } from '@/lib/gamification';

export const GET = withAuth(async (
  request: NextRequest,
  context?: Record<string, unknown>
) => {
  const user = context?.user as { userId: string };
  const { courseId } = await (context as { params: Promise<{ courseId: string }> }).params;

  const data = await getUserGamificationData(user.userId, courseId);

  return NextResponse.json(data);
});
