import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

// Configure VAPID
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:contato@profbarral.com.br';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Send push notification to a single subscription.
 * Returns true if successful, false if subscription is expired/invalid.
 */
async function sendToSubscription(
  subscription: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    // 404 or 410 = subscription expired/invalid, remove it
    if (statusCode === 404 || statusCode === 410) {
      await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => {});
    }
    console.error(`[Push] Failed to send to ${subscription.endpoint.slice(0, 50)}...:`, statusCode);
    return false;
  }
}

/**
 * Send push notification to all subscriptions of a specific user.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  let sent = 0;
  for (const sub of subscriptions) {
    const ok = await sendToSubscription(sub, payload);
    if (ok) sent++;
  }
  return sent;
}

/**
 * Send push notification to all students enrolled in a course.
 */
export async function sendPushToCourse(courseId: string, payload: PushPayload): Promise<number> {
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    select: { userId: true },
  });

  const userIds = [...new Set(enrollments.map((e) => e.userId))];

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });

  let sent = 0;
  for (const sub of subscriptions) {
    const ok = await sendToSubscription(sub, payload);
    if (ok) sent++;
  }
  return sent;
}

/**
 * Send push notification to ALL subscriptions (broadcast).
 */
export async function broadcastPush(payload: PushPayload): Promise<number> {
  const subscriptions = await prisma.pushSubscription.findMany();

  let sent = 0;
  for (const sub of subscriptions) {
    const ok = await sendToSubscription(sub, payload);
    if (ok) sent++;
  }
  return sent;
}
