import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import { sendPushToUser, sendPushToCourse, broadcastPush } from '@/lib/push-notifications';

// POST - Admin endpoint to send push notifications manually
export const POST = withAdminApi(async (request: NextRequest) => {
  const { title, body, url, target, targetId } = await request.json();

  if (!title || !body) {
    throw new ValidationError('Titulo e corpo sao obrigatorios');
  }

  const payload = { title, body, url: url || '/' };
  let sent = 0;

  switch (target) {
    case 'user':
      if (!targetId) {
        throw new ValidationError('userId obrigatorio para target=user');
      }
      sent = await sendPushToUser(targetId, payload);
      break;

    case 'course':
      if (!targetId) {
        throw new ValidationError('courseId obrigatorio para target=course');
      }
      sent = await sendPushToCourse(targetId, payload);
      break;

    case 'all':
    default:
      sent = await broadcastPush(payload);
      break;
  }

  return NextResponse.json({ success: true, sent });
});
