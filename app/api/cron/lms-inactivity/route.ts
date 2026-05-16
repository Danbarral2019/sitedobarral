import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendInactivityReminderEmail } from '@/lib/email';
import { sendPushToUser } from '@/lib/push-notifications';
import { courses } from '@/data/courses';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';

/**
 * Cron Job: Lembrete de inatividade LMS
 *
 * Envia email para alunos que não acessam o LMS há mais de 7 dias.
 * Evita reenvio: só envia se lmsReminderSentAt é null ou > 30 dias.
 * Limite: 50 emails por execução (evitar timeout Vercel).
 *
 * Agendamento: Diário às 10h UTC (7h BRT) — vercel.json
 */

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Auth: CRON_SECRET
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('lms-inactivity', async () => {
    // 1. Find users with active enrollments
    const activeEnrollments = await prisma.enrollment.findMany({
      where: {
        OR: [
          { isLifetime: true },
          { expiresAt: { gte: now } },
        ],
      },
      select: {
        userId: true,
        courseId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            lmsReminderSentAt: true,
          },
        },
      },
    });

    // Filter: only users who haven't received a reminder in the last 30 days
    const eligibleEnrollments = activeEnrollments.filter(e => {
      const sent = e.user.lmsReminderSentAt;
      return !sent || sent < thirtyDaysAgo;
    });

    // Group by user — pick one course per user
    const userMap = new Map<string, { user: typeof eligibleEnrollments[0]['user']; courseId: string }>();
    for (const e of eligibleEnrollments) {
      if (!userMap.has(e.userId)) {
        userMap.set(e.userId, { user: e.user, courseId: e.courseId });
      }
    }

    // 2. For each user, find their last LessonProgress access
    const userIds = [...userMap.keys()];

    const lastAccessByUser = await prisma.lessonProgress.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _max: { lastAccessedAt: true },
    });

    const lastAccessMap = new Map<string, Date | null>();
    for (const row of lastAccessByUser) {
      lastAccessMap.set(row.userId, row._max.lastAccessedAt);
    }

    // 3. Filter: last access between 7 and 60 days ago
    const toNotify: Array<{
      userId: string;
      name: string;
      email: string;
      courseId: string;
      daysSinceAccess: number;
    }> = [];

    for (const [userId, { user, courseId }] of userMap) {
      const lastAccess = lastAccessMap.get(userId);

      // No access at all → skip (they never started)
      if (!lastAccess) continue;

      // Access within 7 days → not inactive
      if (lastAccess >= sevenDaysAgo) continue;

      // Access more than 60 days ago → too old, don't nag
      if (lastAccess < sixtyDaysAgo) continue;

      const daysSinceAccess = Math.floor(
        (now.getTime() - lastAccess.getTime()) / (24 * 60 * 60 * 1000)
      );

      toNotify.push({
        userId,
        name: user.name,
        email: user.email,
        courseId,
        daysSinceAccess,
      });
    }

    // 4. Send emails (limit 50)
    const limit = 50;
    const batch = toNotify.slice(0, limit);

    let sent = 0;
    let skipped = 0;

    for (const student of batch) {
      const course = courses.find(c => c.id === student.courseId);
      const courseTitle = course?.title || 'Curso';
      const courseSlug = course?.slug || '';

      // Send push notification (fire-and-forget)
      sendPushToUser(student.userId, {
        title: 'Sentimos sua falta!',
        body: 'Continue estudando e mantenha seu streak!',
        url: '/area-restrita',
      }).catch(() => {});

      const success = await sendInactivityReminderEmail(
        student.email,
        student.name,
        courseTitle,
        courseSlug,
        student.daysSinceAccess
      );

      if (success) {
        // Update lmsReminderSentAt
        await prisma.user.update({
          where: { id: student.userId },
          data: { lmsReminderSentAt: now },
        });
        sent++;
      } else {
        skipped++;
      }
    }

      console.log(`[lms-inactivity] Processed: ${toNotify.length}, Sent: ${sent}, Skipped: ${skipped}`);

      responseBody = {
        processed: toNotify.length,
        sent,
        skipped,
        limitReached: toNotify.length > limit,
      };
      return {
        itemsFound: toNotify.length,
        itemsNew: sent,
        metadata: { skipped, limitReached: toNotify.length > limit },
      };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
