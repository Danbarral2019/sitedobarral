import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { SubmitQuizAttemptSchema } from '@/lib/validation-schemas';

/**
 * POST: Submete uma tentativa de quiz com correção automática
 */
export const POST = withAuth(async (
  request: NextRequest,
  context?: Record<string, unknown>
) => {
  try {
    const user = context?.user as { userId: string };
    const { lessonId } = await (context as { params: Promise<{ lessonId: string }> }).params;
    const body = await request.json();
    const data = SubmitQuizAttemptSchema.parse(body);

    // Buscar quiz com perguntas
    const quiz = await prisma.quiz.findUnique({
      where: { lessonId },
      include: { questions: true },
    });

    if (!quiz || !quiz.isPublished) {
      throw new NotFoundError('Quiz');
    }

    // Verificar maxAttempts
    if (quiz.maxAttempts) {
      const attemptCount = await prisma.quizAttempt.count({
        where: { quizId: quiz.id, userId: user.userId },
      });
      if (attemptCount >= quiz.maxAttempts) {
        return NextResponse.json(
          { error: 'Número máximo de tentativas atingido.' },
          { status: 400 }
        );
      }
    }

    // Correção automática
    let totalPoints = 0;
    let earnedPoints = 0;
    const results: {
      questionId: string;
      correct: boolean;
      correctOptionId: string;
      selectedOptionId: string;
      explanation: string | null;
      points: number;
    }[] = [];

    for (const question of quiz.questions) {
      const options = JSON.parse(question.options) as { id: string; text: string; isCorrect: boolean }[];
      const correctOption = options.find(o => o.isCorrect);
      const userAnswer = data.answers.find(a => a.questionId === question.id);
      const isCorrect = userAnswer?.selectedOptionId === correctOption?.id;

      totalPoints += question.points;
      if (isCorrect) {
        earnedPoints += question.points;
      }

      results.push({
        questionId: question.id,
        correct: isCorrect,
        correctOptionId: correctOption?.id || '',
        selectedOptionId: userAnswer?.selectedOptionId || '',
        explanation: question.explanation,
        points: isCorrect ? question.points : 0,
      });
    }

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const passed = score >= quiz.passingScore;

    // Criar tentativa
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        userId: user.userId,
        answers: JSON.stringify(data.answers),
        score,
        totalPoints: earnedPoints,
        maxPoints: totalPoints,
        passed,
        startedAt: data.startedAt ? new Date(data.startedAt) : new Date(),
        completedAt: new Date(),
        timeSpentSeconds: data.timeSpentSeconds,
      },
    });

    apiLogger.info(
      { attemptId: attempt.id, quizId: quiz.id, userId: user.userId, score, passed },
      'Quiz attempt submitted'
    );

    // Se passou, verificar elegibilidade para certificado (fire-and-forget)
    if (passed) {
      checkCertificateEligibilityAsync(user.userId, quiz, lessonId).catch(() => {});

      // Gamification: quiz pass
      import('@/lib/gamification').then(({ addXp, checkAndAwardBadges, updateStreak, XP_VALUES }) => {
        // Determine courseId
        prisma.lesson.findUnique({
          where: { id: lessonId },
          include: { module: { select: { courseId: true } } },
        }).then(lesson => {
          if (!lesson) return;
          const courseId = lesson.module.courseId;
          addXp(user.userId, courseId, XP_VALUES.PASS_QUIZ).catch(() => {});
          if (score === 100) {
            addXp(user.userId, courseId, XP_VALUES.PERFECT_QUIZ).catch(() => {});
          }
          updateStreak(user.userId, courseId).catch(() => {});
          checkAndAwardBadges(user.userId, courseId, 'quiz_pass').catch(() => {});
        }).catch(() => {});
      }).catch(() => {});
    }

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        score: Math.round(score * 100) / 100,
        totalPoints: earnedPoints,
        maxPoints: totalPoints,
        passed,
        timeSpentSeconds: data.timeSpentSeconds,
      },
      results,
      passingScore: quiz.passingScore,
    });
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * Verifica se o aluno agora é elegível para certificado (fire-and-forget)
 */
async function checkCertificateEligibilityAsync(
  userId: string,
  quiz: { lessonId: string },
  lessonId: string
) {
  try {
    // Buscar o módulo da lição para identificar o curso
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: true },
    });
    if (!lesson) return;

    const courseId = lesson.module.courseId;

    // Importar e verificar elegibilidade
    const { checkAndIssueCertificate } = await import('@/lib/certificate');
    await checkAndIssueCertificate(userId, courseId);
  } catch (error) {
    apiLogger.error({ userId, lessonId, error }, 'Certificate eligibility check failed');
  }
}
