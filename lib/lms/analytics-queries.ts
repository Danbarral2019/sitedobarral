import { prisma } from '@/lib/prisma';

export interface QuizStats {
  quizId: string;
  totalAttempts: number;
  passedAttempts: number;
  passRate: number;
  avgScore: number;
  uniqueUsers: number;
}

/**
 * Busca estatísticas de N quizzes em UMA query Prisma + agrupa em JS.
 *
 * Substitui o padrão N+1 `quizIds.map(id => prisma.quizAttempt.findMany({ quizId: id }))`
 * que causava uma query por aula com quiz.
 *
 * Retorna `Map<quizId, QuizStats>` para permitir lookup O(1) na rota.
 * Quizzes sem nenhum attempt aparecem no Map com stats zeradas.
 */
export async function getQuizStatsBatch(
  quizIds: string[],
): Promise<Map<string, QuizStats>> {
  if (quizIds.length === 0) return new Map();

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId: { in: quizIds } },
    select: { quizId: true, score: true, passed: true, userId: true },
  });

  const byQuiz = new Map<string, QuizStats>();
  for (const id of quizIds) {
    byQuiz.set(id, {
      quizId: id, totalAttempts: 0, passedAttempts: 0,
      passRate: 0, avgScore: 0, uniqueUsers: 0,
    });
  }

  const usersByQuiz = new Map<string, Set<string>>();
  const scoreSumByQuiz = new Map<string, number>();
  for (const a of attempts) {
    const stats = byQuiz.get(a.quizId);
    if (!stats) continue;
    stats.totalAttempts += 1;
    if (a.passed) stats.passedAttempts += 1;
    scoreSumByQuiz.set(a.quizId, (scoreSumByQuiz.get(a.quizId) ?? 0) + a.score);

    let users = usersByQuiz.get(a.quizId);
    if (!users) {
      users = new Set();
      usersByQuiz.set(a.quizId, users);
    }
    users.add(a.userId);
  }

  for (const [id, stats] of byQuiz) {
    if (stats.totalAttempts > 0) {
      stats.avgScore = Math.round((scoreSumByQuiz.get(id) ?? 0) / stats.totalAttempts);
      stats.passRate = Math.round((stats.passedAttempts / stats.totalAttempts) * 100);
    }
    stats.uniqueUsers = usersByQuiz.get(id)?.size ?? 0;
  }

  return byQuiz;
}
