import { NextRequest, NextResponse } from 'next/server';
import { withUserApi } from '@/lib/api/handler';
import { getUserGamificationData } from '@/lib/gamification';

export const GET = withUserApi<{ courseId: string }>(async (
  request: NextRequest,
  ctx
) => {
  const { courseId } = ctx.params;

  const data = await getUserGamificationData(ctx.user.userId, courseId);

  return NextResponse.json(data);
});
