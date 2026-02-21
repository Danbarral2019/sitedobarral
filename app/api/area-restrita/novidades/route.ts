import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';

const FOURTEEN_DAYS_AGO = 14 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_AGO = 30 * 24 * 60 * 60 * 1000;

async function handler() {
  const fourteenDaysAgo = new Date(Date.now() - FOURTEEN_DAYS_AGO);
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_AGO);

  const [recentNonManualDocs, recentManualDocs, recentBlogPosts, documentUpdates, recentTribunalDecisions] = await Promise.all([
    // Recent documents excluding manual-tcu (which floods the feed with ~165 sections per sync)
    prisma.document.findMany({
      where: {
        uploadedAt: { gte: fourteenDaysAgo },
        reviewed: true,
        isPublic: true,
        NOT: { category: 'manual-tcu' },
      },
      select: {
        id: true,
        title: true,
        category: true,
        type: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: 'desc' },
      take: 15,
    }),
    // Manual TCU sections (limited to avoid flooding)
    prisma.document.findMany({
      where: {
        uploadedAt: { gte: fourteenDaysAgo },
        reviewed: true,
        isPublic: true,
        category: 'manual-tcu',
      },
      select: {
        id: true,
        title: true,
        category: true,
        type: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: 'desc' },
      take: 3,
    }),

    // Recent blog posts (last 30 days)
    prisma.blogPost.findMany({
      where: {
        isPublished: true,
        publishedAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 3,
    }),

    // Recent document updates/versions (last 14 days)
    prisma.documentVersion.findMany({
      where: {
        detectedAt: { gte: fourteenDaysAgo },
      },
      select: {
        id: true,
        changeType: true,
        changesSummary: true,
        detectedAt: true,
        document: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
      },
      orderBy: { detectedAt: 'desc' },
      take: 5,
    }),

    // Recent tribunal decisions (approved, last 30 days)
    prisma.tribunalDecision.findMany({
      where: {
        approvalStatus: { in: ['auto_approved', 'manually_approved'] },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        title: true,
        tribunalCode: true,
        decisionType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  // Platform updates (static for now, easy to maintain)
  const platformUpdates = [
    {
      id: 'gamification',
      title: 'Sistema de Gamificacao',
      description: 'Ganhe XP, badges e acompanhe seu streak de estudos',
      date: '2026-02-10',
      type: 'feature' as const,
    },
    {
      id: 'quizzes',
      title: 'Quizzes e Certificados',
      description: 'Teste seus conhecimentos e obtenha certificados de conclusao',
      date: '2026-02-10',
      type: 'feature' as const,
    },
    {
      id: 'ai-assistant',
      title: 'Assistente IA nas Aulas',
      description: 'Tire duvidas sobre o conteudo da aula com inteligencia artificial',
      date: '2026-02-10',
      type: 'feature' as const,
    },
  ];

  // Map tribunal decisions to document-like shape
  const tribunalAsDocuments = recentTribunalDecisions.map(td => ({
    id: td.id,
    title: td.title,
    category: `tribunal-${td.tribunalCode}`,
    type: td.decisionType,
    uploadedAt: td.createdAt,
  }));

  // Merge and sort by date
  const recentDocuments = [...recentNonManualDocs, ...recentManualDocs, ...tribunalAsDocuments]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  return NextResponse.json({
    recentDocuments,
    recentBlogPosts,
    documentUpdates: documentUpdates.map((v) => ({
      id: v.id,
      documentId: v.document.id,
      changeType: v.changeType,
      changesSummary: v.changesSummary,
      detectedAt: v.detectedAt,
      documentTitle: v.document.title,
      documentCategory: v.document.category,
    })),
    platformUpdates,
  }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
}

export const GET = withAuth(handler);
