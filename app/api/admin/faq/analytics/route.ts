import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET /api/admin/faq/analytics - Estatísticas de uso das FAQs
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // FAQs mais visualizadas
    const mostViewed = await prisma.fAQ.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        question: true,
        category: true,
        viewCount: true,
      },
      orderBy: {
        viewCount: 'desc',
      },
      take: 10,
    });

    // FAQs mais úteis (maior ratio de helpful)
    const allFaqs = await prisma.fAQ.findMany({
      where: {
        isPublished: true,
        OR: [
          { helpfulCount: { gt: 0 } },
          { notHelpfulCount: { gt: 0 } },
        ],
      },
      select: {
        id: true,
        question: true,
        category: true,
        helpfulCount: true,
        notHelpfulCount: true,
      },
    });

    // Calcular taxa de utilidade
    const withRatio = allFaqs.map((faq) => {
      const total = faq.helpfulCount + faq.notHelpfulCount;
      const ratio = total > 0 ? (faq.helpfulCount / total) * 100 : 0;
      return {
        ...faq,
        totalFeedback: total,
        helpfulRatio: Math.round(ratio),
      };
    });

    const mostHelpful = withRatio
      .filter((faq) => faq.totalFeedback >= 3) // Mínimo de 3 feedbacks
      .sort((a, b) => b.helpfulRatio - a.helpfulRatio)
      .slice(0, 10);

    // FAQs com mais feedbacks negativos (para revisão)
    const needsReview = allFaqs
      .map((faq) => {
        const total = faq.helpfulCount + faq.notHelpfulCount;
        const notHelpfulRatio = total > 0 ? (faq.notHelpfulCount / total) * 100 : 0;
        return {
          ...faq,
          totalFeedback: total,
          notHelpfulRatio: Math.round(notHelpfulRatio),
        };
      })
      .filter((faq) => faq.totalFeedback >= 3 && faq.notHelpfulRatio > 50)
      .sort((a, b) => b.notHelpfulRatio - a.notHelpfulRatio)
      .slice(0, 10);

    // Estatísticas gerais
    const totalFaqs = await prisma.fAQ.count();
    const publishedFaqs = await prisma.fAQ.count({ where: { isPublished: true } });
    const totalViews = await prisma.fAQ.aggregate({
      _sum: { viewCount: true },
    });
    const totalFeedbacks = await prisma.fAQFeedback.count();

    // Feedbacks por categoria
    const feedbacksByCategory = await prisma.fAQ.groupBy({
      by: ['category'],
      where: { isPublished: true },
      _sum: {
        viewCount: true,
        helpfulCount: true,
        notHelpfulCount: true,
      },
    });

    // Feedbacks recentes com comentários
    const recentFeedbacksWithComments = await prisma.fAQFeedback.findMany({
      where: {
        comment: { not: null },
      },
      select: {
        id: true,
        faqId: true,
        wasHelpful: true,
        comment: true,
        userEmail: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    // Buscar as perguntas relacionadas aos feedbacks
    const faqIds = [...new Set(recentFeedbacksWithComments.map((f) => f.faqId))];
    const faqsMap = await prisma.fAQ.findMany({
      where: { id: { in: faqIds } },
      select: { id: true, question: true, category: true },
    });

    const faqsById = Object.fromEntries(faqsMap.map((f) => [f.id, f]));

    const recentComments = recentFeedbacksWithComments.map((feedback) => ({
      ...feedback,
      faq: faqsById[feedback.faqId],
    }));

    return NextResponse.json({
      overview: {
        totalFaqs,
        publishedFaqs,
        totalViews: totalViews._sum.viewCount || 0,
        totalFeedbacks,
      },
      mostViewed,
      mostHelpful,
      needsReview,
      feedbacksByCategory,
      recentComments,
    });
  } catch (error) {
    console.error('Error fetching FAQ analytics:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas' },
      { status: 500 }
    );
  }
}
