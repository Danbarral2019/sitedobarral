import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import NovidadesClient from './NovidadesClient';

export const revalidate = 3600; // ISR: revalidar a cada 1 hora

interface SearchParams {
  mes?: string; // formato: "2026-03"
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const params = await searchParams;
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const { year, month } = parseMonth(params.mes);
  const monthLabel = `${monthNames[month - 1]} de ${year}`;

  return {
    title: `Novidades de ${monthLabel}`,
    description: `Documentos, decisões e conteúdos adicionados em ${monthLabel} na plataforma do Prof. Daniel Barral. Acórdãos, pareceres, orientações normativas e mais.`,
    openGraph: {
      title: `Novidades de ${monthLabel} | Prof. Daniel Barral`,
      description: `Documentos e decisões de ${monthLabel} sobre Licitações e Contratos`,
      url: `https://profdanielbarral.com/novidades${params.mes ? `?mes=${params.mes}` : ''}`,
      type: 'website',
      locale: 'pt_BR',
    },
    alternates: {
      canonical: '/novidades',
    },
  };
}

function parseMonth(mes?: string): { year: number; month: number } {
  if (mes) {
    const match = mes.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      if (month >= 1 && month <= 12 && year >= 2020 && year <= 2100) {
        return { year, month };
      }
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default async function NovidadesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { year, month } = parseMonth(params.mes);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  let documents: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    uploadedAt: Date;
  }> = [];
  let tribunalDecisions: Array<{
    id: string;
    title: string;
    tribunalCode: string;
    summary: string | null;
    ementa: string;
    createdAt: Date;
  }> = [];
  let blogPosts: Array<{
    title: string;
    slug: string;
    excerpt: string;
    publishedAt: Date;
  }> = [];
  let publications: Array<{
    title: string;
    type: string;
    description: string;
    externalUrl: string | null;
    publishedAt: Date;
  }> = [];
  let videos: Array<{
    title: string;
    courseId: string;
    youtubeUrl: string | null;
    createdAt: Date;
  }> = [];
  let legislativeActs: Array<{
    fullNumber: string;
    title: string;
    ementa: string;
    publishDate: Date;
  }> = [];

  try {
    [documents, tribunalDecisions, blogPosts, publications, videos, legislativeActs] = await Promise.all([
      prisma.document.findMany({
        where: { uploadedAt: { gte: startDate, lte: endDate }, isPublic: true },
        orderBy: { uploadedAt: 'desc' },
        select: { id: true, title: true, description: true, category: true, uploadedAt: true },
      }),
      prisma.tribunalDecision.findMany({
        where: {
          approvalStatus: { in: ['auto_approved', 'manually_approved'] },
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, tribunalCode: true, summary: true, ementa: true, createdAt: true },
      }),
      prisma.blogPost.findMany({
        where: { publishedAt: { gte: startDate, lte: endDate }, isPublished: true },
        orderBy: { publishedAt: 'desc' },
        select: { title: true, slug: true, excerpt: true, publishedAt: true },
      }),
      prisma.publication.findMany({
        where: { publishedAt: { gte: startDate, lte: endDate }, isPublished: true },
        orderBy: { publishedAt: 'desc' },
        select: { title: true, type: true, description: true, externalUrl: true, publishedAt: true },
      }),
      prisma.courseVideo.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          isActive: true,
          storageType: 'youtube', // /novidades é surface de embed YouTube; vídeos R2 não pertencem aqui
        },
        orderBy: { createdAt: 'desc' },
        select: { title: true, courseId: true, youtubeUrl: true, createdAt: true },
      }),
      prisma.legislativeAct.findMany({
        where: { publishDate: { gte: startDate, lte: endDate }, revoked: false },
        orderBy: { publishDate: 'desc' },
        select: { fullNumber: true, title: true, ementa: true, publishDate: true },
      }),
    ]);
  } catch {
    // Database unavailable (e.g. CI build)
  }

  // Group documents by category
  const documentsByCategory: Record<string, typeof documents> = {};
  for (const doc of documents) {
    if (!documentsByCategory[doc.category]) {
      documentsByCategory[doc.category] = [];
    }
    documentsByCategory[doc.category].push(doc);
  }

  const totalItems = documents.length + tribunalDecisions.length;

  return (
    <NovidadesClient
      year={year}
      month={month}
      documentsByCategory={documentsByCategory}
      tribunalDecisions={tribunalDecisions}
      blogPosts={blogPosts}
      publications={publications}
      videos={videos}
      legislativeActs={legislativeActs}
      totalItems={totalItems}
    />
  );
}
