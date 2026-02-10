import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { courses } from '@/data/courses';

export const GET = withAdminAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (courseId) {
    return getCourseAnalytics(courseId, now, thirtyDaysAgo, sevenDaysAgo);
  }

  return getGlobalAnalytics(now, thirtyDaysAgo, sevenDaysAgo);
});

async function getGlobalAnalytics(
  now: Date,
  thirtyDaysAgo: Date,
  sevenDaysAgo: Date
) {
  // Active enrollments (not expired or lifetime)
  const activeEnrollments = await prisma.enrollment.findMany({
    where: {
      OR: [
        { isLifetime: true },
        { expiresAt: { gte: now } },
      ],
    },
    select: { userId: true, courseId: true },
  });

  const uniqueStudentIds = [...new Set(activeEnrollments.map(e => e.userId))];

  // Lessons completed
  const completedLessons = await prisma.lessonProgress.count({
    where: { status: 'completed' },
  });

  // Certificates
  const totalCertificates = await prisma.certificate.count();

  // Quizzes passed
  const quizzesApproved = await prisma.quizAttempt.count({
    where: { passed: true },
  });

  // Activity last 30 days (grouped by day)
  const activityRaw = await prisma.lessonProgress.findMany({
    where: {
      lastAccessedAt: { gte: thirtyDaysAgo },
    },
    select: { lastAccessedAt: true },
  });

  const activityByDay: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    activityByDay[d.toISOString().split('T')[0]] = 0;
  }
  for (const r of activityRaw) {
    if (r.lastAccessedAt) {
      const key = r.lastAccessedAt.toISOString().split('T')[0];
      if (activityByDay[key] !== undefined) activityByDay[key]++;
    }
  }

  const activityChart = Object.entries(activityByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // Inactive students (enrolled, last access > 7 days)
  const allProgressByUser = await prisma.lessonProgress.groupBy({
    by: ['userId'],
    _max: { lastAccessedAt: true },
  });

  const activeUserIds = new Set(uniqueStudentIds);
  const inactiveStudents: Array<{
    userId: string;
    lastAccess: Date | null;
    daysSince: number;
  }> = [];

  for (const p of allProgressByUser) {
    if (!activeUserIds.has(p.userId)) continue;
    const lastAccess = p._max.lastAccessedAt;
    if (!lastAccess || lastAccess < sevenDaysAgo) {
      const daysSince = lastAccess
        ? Math.floor((now.getTime() - lastAccess.getTime()) / (24 * 60 * 60 * 1000))
        : 999;
      inactiveStudents.push({ userId: p.userId, lastAccess, daysSince });
    }
  }

  // Get user details for inactive students (top 20)
  const topInactive = inactiveStudents
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 20);

  const inactiveUserDetails = topInactive.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: topInactive.map(s => s.userId) } },
        select: { id: true, name: true, email: true },
      })
    : [];

  const inactiveList = topInactive.map(s => {
    const user = inactiveUserDetails.find(u => u.id === s.userId);
    return {
      userId: s.userId,
      name: user?.name || 'Desconhecido',
      email: user?.email || '',
      lastAccess: s.lastAccess,
      daysSince: s.daysSince,
    };
  });

  // Per-course summary
  const enrollmentsByCourse: Record<string, number> = {};
  for (const e of activeEnrollments) {
    enrollmentsByCourse[e.courseId] = (enrollmentsByCourse[e.courseId] || 0) + 1;
  }

  const courseSummary = courses.map(c => ({
    courseId: c.id,
    title: c.title,
    activeStudents: enrollmentsByCourse[c.id] || 0,
  }));

  const response = NextResponse.json({
    summary: {
      activeStudents: uniqueStudentIds.length,
      completedLessons,
      totalCertificates,
      quizzesApproved,
    },
    activityChart,
    inactiveStudents: inactiveList,
    courseSummary,
  });

  response.headers.set('Cache-Control', 'public, max-age=60');
  return response;
}

async function getCourseAnalytics(
  courseId: string,
  now: Date,
  thirtyDaysAgo: Date,
  _sevenDaysAgo: Date
) {
  // Active enrollments for this course
  const enrollments = await prisma.enrollment.findMany({
    where: {
      courseId,
      OR: [
        { isLifetime: true },
        { expiresAt: { gte: now } },
      ],
    },
    select: { userId: true },
  });

  const enrolledUserIds = enrollments.map(e => e.userId);

  // Get modules + lessons for this course
  const modules = await prisma.module.findMany({
    where: { courseId, isPublished: true },
    include: {
      lessons: {
        where: { isPublished: true },
        select: {
          id: true,
          title: true,
          moduleId: true,
          requiresQuizPass: true,
          quiz: { select: { id: true } },
        },
        orderBy: { displayOrder: 'asc' },
      },
    },
    orderBy: { displayOrder: 'asc' },
  });

  const allLessonIds = modules.flatMap(m => m.lessons.map(l => l.id));
  const totalLessons = allLessonIds.length;

  // Progress for enrolled users
  const progress = await prisma.lessonProgress.findMany({
    where: {
      userId: { in: enrolledUserIds },
      lessonId: { in: allLessonIds },
    },
    select: {
      userId: true,
      lessonId: true,
      status: true,
      lastAccessedAt: true,
    },
  });

  // Funnel: enrolled → started (>=1 lesson) → completed (100%) → certificate
  const progressByUser = new Map<string, { started: number; completed: number; lastAccess: Date | null }>();
  for (const p of progress) {
    const existing = progressByUser.get(p.userId) || { started: 0, completed: 0, lastAccess: null };
    existing.started++;
    if (p.status === 'completed') existing.completed++;
    if (p.lastAccessedAt && (!existing.lastAccess || p.lastAccessedAt > existing.lastAccess)) {
      existing.lastAccess = p.lastAccessedAt;
    }
    progressByUser.set(p.userId, existing);
  }

  const startedCount = [...progressByUser.values()].filter(v => v.started > 0).length;
  const completedAllCount = [...progressByUser.values()].filter(v => v.completed >= totalLessons && totalLessons > 0).length;

  const certificateCount = await prisma.certificate.count({ where: { courseId } });

  const funnel = {
    enrolled: enrolledUserIds.length,
    started: startedCount,
    completedAll: completedAllCount,
    certified: certificateCount,
  };

  // Progress per module
  const moduleProgress = modules.map(m => {
    const lessonIds = m.lessons.map(l => l.id);
    const totalInModule = lessonIds.length;
    if (totalInModule === 0) {
      return { moduleId: m.id, title: m.title, avgCompletion: 0, totalLessons: 0 };
    }

    let totalCompletion = 0;
    let usersWithProgress = 0;

    for (const userId of enrolledUserIds) {
      const userLessons = progress.filter(p => p.userId === userId && lessonIds.includes(p.lessonId));
      const completedInModule = userLessons.filter(p => p.status === 'completed').length;
      if (userLessons.length > 0) {
        usersWithProgress++;
        totalCompletion += (completedInModule / totalInModule) * 100;
      }
    }

    return {
      moduleId: m.id,
      title: m.title,
      avgCompletion: usersWithProgress > 0 ? Math.round(totalCompletion / usersWithProgress) : 0,
      totalLessons: totalInModule,
    };
  });

  // Quiz stats
  const quizIds = modules.flatMap(m =>
    m.lessons.filter(l => l.quiz).map(l => ({ lessonTitle: l.title, quizId: l.quiz!.id }))
  );

  const quizStats = await Promise.all(
    quizIds.map(async ({ lessonTitle, quizId }) => {
      const attempts = await prisma.quizAttempt.findMany({
        where: { quizId },
        select: { score: true, passed: true, userId: true },
      });

      const totalAttempts = attempts.length;
      const passedAttempts = attempts.filter(a => a.passed).length;
      const avgScore = totalAttempts > 0
        ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts)
        : 0;
      const uniqueUsers = new Set(attempts.map(a => a.userId)).size;

      return {
        lessonTitle,
        quizId,
        totalAttempts,
        passedAttempts,
        passRate: totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0,
        avgScore,
        uniqueUsers,
      };
    })
  );

  // Student table
  const userDetails = enrolledUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: enrolledUserIds } },
        select: { id: true, name: true, email: true },
      })
    : [];

  // Quiz scores by user
  const allQuizAttempts = quizIds.length > 0
    ? await prisma.quizAttempt.findMany({
        where: { quizId: { in: quizIds.map(q => q.quizId) }, userId: { in: enrolledUserIds } },
        select: { userId: true, score: true },
      })
    : [];

  const quizScoresByUser = new Map<string, number[]>();
  for (const a of allQuizAttempts) {
    const scores = quizScoresByUser.get(a.userId) || [];
    scores.push(a.score);
    quizScoresByUser.set(a.userId, scores);
  }

  const students = userDetails.map(u => {
    const userProgress = progressByUser.get(u.id) || { started: 0, completed: 0, lastAccess: null };
    const completionPct = totalLessons > 0
      ? Math.round((userProgress.completed / totalLessons) * 100)
      : 0;
    const lastAccess = userProgress.lastAccess;
    const daysSinceAccess = lastAccess
      ? Math.floor((now.getTime() - lastAccess.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    let status: 'active' | 'at_risk' | 'inactive' = 'active';
    if (daysSinceAccess === null || daysSinceAccess > 30) status = 'inactive';
    else if (daysSinceAccess > 7) status = 'at_risk';

    const scores = quizScoresByUser.get(u.id) || [];
    const avgQuizScore = scores.length > 0
      ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      : null;

    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      completionPct,
      lastAccess,
      daysSinceAccess,
      status,
      avgQuizScore,
    };
  }).sort((a, b) => (b.completionPct - a.completionPct) || (a.name.localeCompare(b.name)));

  // Activity chart (30 days)
  const courseProgress = await prisma.lessonProgress.findMany({
    where: {
      lessonId: { in: allLessonIds },
      lastAccessedAt: { gte: thirtyDaysAgo },
    },
    select: { lastAccessedAt: true },
  });

  const activityByDay: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    activityByDay[d.toISOString().split('T')[0]] = 0;
  }
  for (const r of courseProgress) {
    if (r.lastAccessedAt) {
      const key = r.lastAccessedAt.toISOString().split('T')[0];
      if (activityByDay[key] !== undefined) activityByDay[key]++;
    }
  }

  const activityChart = Object.entries(activityByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const response = NextResponse.json({
    courseId,
    funnel,
    moduleProgress,
    quizStats,
    students,
    activityChart,
  });

  response.headers.set('Cache-Control', 'public, max-age=60');
  return response;
}
