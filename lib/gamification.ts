import { prisma } from './prisma';
import { apiLogger } from './logger';
import { XP_VALUES, BADGE_TYPES, type BadgeType } from './gamification-constants';

// As constantes vivem num módulo puro para que o cliente possa usá-las sem
// levar o Prisma junto (issue #212). Reexportadas aqui para o servidor.
export { XP_VALUES, BADGE_TYPES };
export type { BadgeType };

// ═══════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════

/**
 * Add XP to a user's streak record for a course (atomic increment)
 */
export async function addXp(userId: string, courseId: string, amount: number) {
  await prisma.userStreak.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, totalXp: amount },
    update: { totalXp: { increment: amount } },
  });
}

/**
 * Update streak for a user on a course.
 * Should be called once per day when user has activity.
 */
export async function updateStreak(userId: string, courseId: string) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const streak = await prisma.userStreak.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, currentStreak: 1, longestStreak: 1, lastActivityDate: today },
    update: {},
  });

  // Already updated today
  if (streak.lastActivityDate === today) return streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newCurrent: number;
  if (streak.lastActivityDate === yesterdayStr) {
    // Consecutive day
    newCurrent = streak.currentStreak + 1;
  } else {
    // Gap — reset streak
    newCurrent = 1;
  }

  const newLongest = Math.max(streak.longestStreak, newCurrent);

  const updated = await prisma.userStreak.update({
    where: { id: streak.id },
    data: {
      currentStreak: newCurrent,
      longestStreak: newLongest,
      lastActivityDate: today,
    },
  });

  // Check streak badges
  if (newCurrent >= 7) {
    await awardBadge(userId, 'streak_7', courseId);
    await addXp(userId, courseId, XP_VALUES.STREAK_7);
  }
  if (newCurrent >= 30) {
    await awardBadge(userId, 'streak_30', courseId);
    await addXp(userId, courseId, XP_VALUES.STREAK_30);
  }

  return updated;
}

/**
 * Award a badge to a user (ignores duplicates via P2002)
 */
export async function awardBadge(
  userId: string,
  type: string,
  courseId?: string | null,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  try {
    await prisma.badge.create({
      data: {
        userId,
        type,
        courseId: courseId ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    // Push notification (fire-and-forget, server-only)
    if (typeof window === 'undefined') {
      const badgeInfo = BADGE_TYPES[type as BadgeType];
      const badgeLabel = badgeInfo ? `${badgeInfo.icon} ${badgeInfo.label}` : type;
      import(/* webpackIgnore: true */ '@/lib/push-notifications')
        .then(({ sendPushToUser }) =>
          sendPushToUser(userId, {
            title: 'Badge Conquistado!',
            body: `Voce ganhou: ${badgeLabel}`,
            url: '/area-restrita/meu-progresso',
          })
        )
        .catch((err) => {
          // Push é best-effort (aluno pode não ter inscrição válida). Logamos pra
          // detectar falhas sistêmicas (push-notifications module quebrado, fila
          // travada) sem bloquear awarding do badge.
          apiLogger.warn(
            { userId, badgeType: type, badgeLabel, err },
            'awardBadge: push notification failed (badge still awarded in DB)'
          );
        });
    }

    return true; // New badge awarded
  } catch (error: unknown) {
    // P2002 = unique constraint violation (badge already exists)
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return false;
    }
    throw error;
  }
}

/**
 * Check and award badges based on event type
 */
export async function checkAndAwardBadges(
  userId: string,
  courseId: string,
  event: 'lesson_complete' | 'quiz_pass' | 'module_complete' | 'course_complete'
) {
  switch (event) {
    case 'lesson_complete': {
      // First lesson badge
      const lessonCount = await prisma.lessonProgress.count({
        where: { userId, status: 'completed' },
      });
      if (lessonCount === 1) {
        await awardBadge(userId, 'first_lesson', courseId);
      }
      break;
    }

    case 'quiz_pass': {
      // First quiz badge
      const quizCount = await prisma.quizAttempt.count({
        where: { userId, passed: true },
      });
      if (quizCount === 1) {
        await awardBadge(userId, 'first_quiz', courseId);
      }
      break;
    }

    case 'module_complete': {
      await awardBadge(userId, 'module_complete', courseId);
      break;
    }

    case 'course_complete': {
      await awardBadge(userId, 'course_complete', courseId);
      await addXp(userId, courseId, XP_VALUES.COMPLETE_COURSE);
      break;
    }

  }
}

/**
 * Orquestra a concessão de XP/badge quando um aluno PASSA num quiz.
 * Deve ser agendada via `runAfterResponse` no handler de submit (o trabalho
 * roda após a resposta e a Vercel mantém a função viva). Deps injetáveis
 * para teste; o default usa as funções reais deste módulo.
 */
export async function awardQuizPass(
  userId: string,
  courseId: string,
  score: number,
  deps: {
    addXp: typeof addXp;
    updateStreak: typeof updateStreak;
    checkAndAwardBadges: typeof checkAndAwardBadges;
  } = { addXp, updateStreak, checkAndAwardBadges }
): Promise<void> {
  await deps.addXp(userId, courseId, XP_VALUES.PASS_QUIZ);
  if (score === 100) {
    await deps.addXp(userId, courseId, XP_VALUES.PERFECT_QUIZ);
  }
  await deps.updateStreak(userId, courseId);
  await deps.checkAndAwardBadges(userId, courseId, 'quiz_pass');
}

/**
 * Get full gamification data for a user in a course
 */
export async function getUserGamificationData(userId: string, courseId: string) {
  const [badges, streak, leaderboardPosition] = await Promise.all([
    prisma.badge.findMany({
      where: { userId, OR: [{ courseId }, { courseId: null }] },
      orderBy: { awardedAt: 'desc' },
    }),
    prisma.userStreak.findUnique({
      where: { userId_courseId: { userId, courseId } },
    }),
    getLeaderboardPosition(userId, courseId),
  ]);

  return {
    badges: badges.map(b => ({
      id: b.id,
      ...(BADGE_TYPES[b.type as BadgeType] || { type: b.type, label: b.type, icon: '\u{1F3C6}', description: '' }),
      metadata: b.metadata ? JSON.parse(b.metadata) : null,
      awardedAt: b.awardedAt,
    })),
    streak: {
      current: streak?.currentStreak ?? 0,
      longest: streak?.longestStreak ?? 0,
      lastActivityDate: streak?.lastActivityDate ?? null,
    },
    xp: streak?.totalXp ?? 0,
    showOnLeaderboard: streak?.showOnLeaderboard ?? true,
    leaderboardPosition,
  };
}

/**
 * Get leaderboard position for a user in a course
 */
async function getLeaderboardPosition(userId: string, courseId: string): Promise<number | null> {
  const userStreak = await prisma.userStreak.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { totalXp: true },
  });

  if (!userStreak) return null;

  const ahead = await prisma.userStreak.count({
    where: {
      courseId,
      showOnLeaderboard: true,
      totalXp: { gt: userStreak.totalXp },
    },
  });

  return ahead + 1;
}
