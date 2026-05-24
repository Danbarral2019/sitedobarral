import { prisma } from './prisma';
import { apiLogger } from './logger';

// ═══════════════════════════════════════════════════════
// XP Values
// ═══════════════════════════════════════════════════════

export const XP_VALUES = {
  COMPLETE_LESSON: 10,
  PASS_QUIZ: 25,
  PERFECT_QUIZ: 50,
  COMPLETE_MODULE: 50,
  COMPLETE_COURSE: 200,
  STREAK_7: 30,
  STREAK_30: 100,
} as const;

// ═══════════════════════════════════════════════════════
// Badge Types
// ═══════════════════════════════════════════════════════

export const BADGE_TYPES = {
  // Autom\u00E1ticos (concedidos por eventos do sistema)
  first_lesson:     { type: 'first_lesson',     label: 'Primeira Aula',    icon: '\u{1F4D6}', description: 'Completou sua primeira aula', award: 'auto' },
  first_quiz:       { type: 'first_quiz',       label: 'Primeiro Quiz',    icon: '\u2705',     description: 'Passou no primeiro quiz', award: 'auto' },
  module_complete:  { type: 'module_complete',   label: 'Modulo Completo',  icon: '\u{1F3AF}', description: 'Concluiu um modulo inteiro', award: 'auto' },
  course_complete:  { type: 'course_complete',   label: 'Curso Completo',   icon: '\u{1F393}', description: 'Concluiu 100% do curso', award: 'auto' },
  streak_7:         { type: 'streak_7',          label: '7 Dias Seguidos',  icon: '\u{1F525}', description: 'Estudou 7 dias consecutivos', award: 'auto' },
  streak_30:        { type: 'streak_30',         label: '30 Dias Seguidos', icon: '\u26A1',     description: 'Estudou 30 dias consecutivos', award: 'auto' },
  // Manuais (admin concede via /admin/badges)
  mentor:           { type: 'mentor',            label: 'Mentor',           icon: '\u{1F9D1}\u200D\u{1F3EB}', description: 'Ajudou colegas com excel\u00EAncia', award: 'manual' },
  feedback_giver:   { type: 'feedback_giver',    label: 'Construtor',       icon: '\u{1F4AC}', description: 'Forneceu feedback construtivo ao curso', award: 'manual' },
  early_adopter:    { type: 'early_adopter',     label: 'Primeira Turma',   icon: '\u{1F31F}', description: 'Aluno da primeira turma da plataforma', award: 'manual' },
  community_builder:{ type: 'community_builder', label: 'Construtor da Comunidade', icon: '\u{1F91D}', description: 'Contribuiu para construir a comunidade', award: 'manual' },
  legal_eagle:      { type: 'legal_eagle',       label: 'Mestre da Lei 14.133', icon: '\u2696\uFE0F', description: 'Excel\u00EAncia no estudo da Nova Lei de Licita\u00E7\u00F5es', award: 'manual' },
  tcu_master:       { type: 'tcu_master',        label: 'Especialista TCU', icon: '\u{1F3DB}\uFE0F', description: 'Dom\u00EDnio profundo da jurisprud\u00EAncia do TCU', award: 'manual' },
} as const;

export type BadgeType = keyof typeof BADGE_TYPES;

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
