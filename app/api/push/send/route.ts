import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { sendPushToUser, sendPushToCourse, broadcastPush } from '@/lib/push-notifications';

// POST - Admin endpoint to send push notifications manually
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const { title, body, url, target, targetId } = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: 'Titulo e corpo sao obrigatorios' },
        { status: 400 }
      );
    }

    const payload = { title, body, url: url || '/' };
    let sent = 0;

    switch (target) {
      case 'user':
        if (!targetId) {
          return NextResponse.json({ error: 'userId obrigatorio para target=user' }, { status: 400 });
        }
        sent = await sendPushToUser(targetId, payload);
        break;

      case 'course':
        if (!targetId) {
          return NextResponse.json({ error: 'courseId obrigatorio para target=course' }, { status: 400 });
        }
        sent = await sendPushToCourse(targetId, payload);
        break;

      case 'all':
      default:
        sent = await broadcastPush(payload);
        break;
    }

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error('[Push Send] Error:', error);
    return NextResponse.json({ error: 'Erro ao enviar notificacao' }, { status: 500 });
  }
});
