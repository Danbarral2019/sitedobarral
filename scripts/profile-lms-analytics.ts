/* eslint-disable no-console */
import { prisma } from '@/lib/prisma';

async function reportScale() {
  const counts = await prisma.$queryRaw<Array<{ tbl: string; n: bigint }>>`
    SELECT 'Enrollment' AS tbl, COUNT(*)::bigint AS n FROM "Enrollment"
    UNION ALL SELECT 'LessonProgress', COUNT(*)::bigint FROM "LessonProgress"
    UNION ALL SELECT 'QuizAttempt', COUNT(*)::bigint FROM "QuizAttempt"
    UNION ALL SELECT 'Lesson', COUNT(*)::bigint FROM "Lesson"
    UNION ALL SELECT 'Module', COUNT(*)::bigint FROM "Module"
    UNION ALL SELECT 'Quiz', COUNT(*)::bigint FROM "Quiz"
    UNION ALL SELECT 'Certificate', COUNT(*)::bigint FROM "Certificate"
  `;
  console.log('=== Dataset scale (prod) ===');
  for (const c of counts) console.log(`  ${c.tbl}: ${c.n}`);
}

async function pickRichestCourse(): Promise<{
  courseId: string;
  enrolledUserIds: string[];
  lessonIds: string[];
  quizIds: string[];
}> {
  // Pick course with most lessonProgress rows (= most analytics work)
  const ranking = await prisma.$queryRaw<Array<{ courseId: string; n: bigint }>>`
    SELECT m."courseId", COUNT(*)::bigint AS n
    FROM "LessonProgress" p
    JOIN "Lesson" l ON l.id = p."lessonId"
    JOIN "Module" m ON m.id = l."moduleId"
    GROUP BY m."courseId"
    ORDER BY n DESC
    LIMIT 5
  `;
  console.log('\nTop 5 courses by LessonProgress rows:');
  for (const c of ranking) console.log(`  course ${c.courseId}: ${c.n} progress rows`);
  const courseId = ranking[0]?.courseId;
  if (!courseId) throw new Error('No lessonProgress found');

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    select: { userId: true },
  });
  const enrolledUserIds = enrollments.map(e => e.userId);

  const modules = await prisma.module.findMany({
    where: { courseId, isPublished: true },
    include: {
      lessons: {
        where: { isPublished: true },
        select: { id: true, quiz: { select: { id: true } } },
      },
    },
  });
  const lessonIds = modules.flatMap(m => m.lessons.map(l => l.id));
  const quizIds = modules.flatMap(m => m.lessons.filter(l => l.quiz).map(l => l.quiz!.id));

  // Fallback: if no quizzes published in this course, grab ANY quizIds with attempts
  let effectiveQuizIds = quizIds;
  if (effectiveQuizIds.length === 0) {
    const top = await prisma.$queryRaw<Array<{ quizId: string; n: bigint }>>`
      SELECT "quizId", COUNT(*)::bigint AS n
      FROM "QuizAttempt"
      GROUP BY "quizId"
      ORDER BY n DESC
      LIMIT 20
    `;
    effectiveQuizIds = top.map(r => r.quizId);
    console.log(`  (course has no published quizzes; using top ${effectiveQuizIds.length} quizzes by attempts globally)`);
  }

  return { courseId, enrolledUserIds, lessonIds, quizIds: effectiveQuizIds };
}

async function explain(label: string, sql: string, params: unknown[]) {
  console.log(`\n========== ${label} ==========`);
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
      `EXPLAIN (ANALYZE, BUFFERS, TIMING) ${sql}`,
      ...params,
    );
    for (const r of rows) console.log(r['QUERY PLAN']);
  } catch (err) {
    console.error(`FAILED: ${(err as Error).message}`);
  }
}

async function main() {
  await reportScale();
  const { courseId, enrolledUserIds, lessonIds, quizIds } = await pickRichestCourse();
  console.log(`\nUsing courseId=${courseId}`);
  console.log(`  enrolledUserIds: ${enrolledUserIds.length}`);
  console.log(`  lessonIds:       ${lessonIds.length}`);
  console.log(`  quizIds:         ${quizIds.length}`);

  if (quizIds.length === 0) {
    console.log('No quizzes available globally; skipping quiz queries.');
  }

  if (quizIds.length > 0) {
    // ATUAL: query individual (uma das N do loop atual)
    await explain(
      'CURRENT — quizAttempt.findMany por quizId (executada N vezes no loop)',
      `SELECT score, passed, "userId" FROM "QuizAttempt" WHERE "quizId" = $1`,
      [quizIds[0]],
    );

    // PROPOSTO: batch agregado
    await explain(
      'PROPOSED — getQuizStatsBatch (1 query, agregado no banco)',
      `SELECT "quizId",
              COUNT(*)::bigint AS total_attempts,
              SUM(CASE WHEN passed THEN 1 ELSE 0 END)::bigint AS passed_attempts,
              AVG(score)::float AS avg_score,
              COUNT(DISTINCT "userId")::bigint AS unique_users
       FROM "QuizAttempt"
       WHERE "quizId" = ANY($1::text[])
       GROUP BY "quizId"`,
      [quizIds],
    );
  }

  // ATUAL: lessonProgress.findMany (traz todas as rows do curso)
  await explain(
    'CURRENT — lessonProgress.findMany do curso (sem agregação no banco)',
    `SELECT "userId", "lessonId", status, "lastAccessedAt"
     FROM "LessonProgress"
     WHERE "userId" = ANY($1::text[]) AND "lessonId" = ANY($2::text[])`,
    [enrolledUserIds, lessonIds],
  );

  // PROPOSTO: contagem agregada por módulo no banco (substitui loop quadrático)
  await explain(
    'PROPOSED — moduleProgress agregado (substitui loop O(users × lessons × progress))',
    `WITH user_module AS (
       SELECT
         l."moduleId",
         p."userId",
         COUNT(*) FILTER (WHERE p.status = 'completed')::float
           / NULLIF(COUNT(*)::float, 0) * 100 AS pct
       FROM "LessonProgress" p
       JOIN "Lesson" l ON l.id = p."lessonId"
       WHERE p."userId" = ANY($1::text[]) AND p."lessonId" = ANY($2::text[])
       GROUP BY l."moduleId", p."userId"
     )
     SELECT "moduleId", AVG(pct)::float AS avg_completion
     FROM user_module
     GROUP BY "moduleId"`,
    [enrolledUserIds, lessonIds],
  );

  // ATUAL: activityRaw — trazia todas as rows pra contar por dia em JS
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await explain(
    'CURRENT — activityRaw (findMany dos últimos 30 dias)',
    `SELECT "lastAccessedAt"
     FROM "LessonProgress"
     WHERE "lastAccessedAt" >= $1`,
    [thirtyDaysAgo],
  );

  // PROPOSTO: agregação por dia no banco
  await explain(
    'PROPOSED — getDailyActivity (GROUP BY date no banco)',
    `SELECT DATE_TRUNC('day', "lastAccessedAt")::date AS day, COUNT(*)::bigint AS n
     FROM "LessonProgress"
     WHERE "lastAccessedAt" >= $1
     GROUP BY 1
     ORDER BY 1`,
    [thirtyDaysAgo],
  );

  // ATUAL: groupBy global por userId (inactive students)
  await explain(
    'CURRENT — groupBy userId em LessonProgress (global)',
    `SELECT "userId", MAX("lastAccessedAt") AS max_la
     FROM "LessonProgress"
     GROUP BY "userId"`,
    [],
  );

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
