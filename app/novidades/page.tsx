import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import NovidadesClient from './NovidadesClient';
import { getSiteUrl } from '@/lib/site-url';

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
      title: `Novidades de ${monthLabel}`,
      description: `Documentos e decisões de ${monthLabel} sobre Licitações e Contratos`,
      url: new URL(`/novidades${params.mes ? `?mes=${params.mes}` : ''}`, getSiteUrl()),
      type: 'website',
      locale: 'pt_BR',
    },
    alternates: {
      canonical: new URL('/novidades', getSiteUrl()),
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

// Três linhas de text-sm na coluna max-w-4xl comportam cerca de 370
// caracteres; 500 sobra folga sem mudar o que o line-clamp exibe.
const LIMITE_RESUMO = 500;

function trechoDaDecisao(summary: string | null, ementa: string): string {
  if (summary) return summary.length > LIMITE_RESUMO ? summary.slice(0, LIMITE_RESUMO) : summary;
  return ementa.length > 250 ? `${ementa.substring(0, 250)}...` : ementa;
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

  // A lista mostra de cada decisão só o resumo (limitado a três linhas) ou os
  // 250 primeiros caracteres da ementa. Enviar os textos inteiros ao cliente
  // levava a página a 6,8 MB de HTML em setembro de 2026 (1.494 decisões,
  // ementas de até 46 mil caracteres); agora vai só o trecho exibido.
  const decisoes = tribunalDecisions.map(({ summary, ementa, ...resto }) => ({
    ...resto,
    trecho: trechoDaDecisao(summary, ementa),
  }));

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
      tribunalDecisions={decisoes}
      blogPosts={blogPosts}
      publications={publications}
      videos={videos}
      legislativeActs={legislativeActs}
      totalItems={totalItems}
    />
  );
}
