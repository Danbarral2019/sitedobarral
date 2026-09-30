import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import NovidadesClient from './NovidadesClient';
import { getSiteUrl } from '@/lib/site-url';

export const revalidate = 3600; // ISR: revalidar a cada 1 hora

interface SearchParams {
  mes?: string; // formato: "2026-03"
  secao?: string; // 'decisoes' ou a categoria do documento
  pagina?: string;
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

// O resumo do mês mostra os primeiros itens de cada seção e leva à lista
// completa da seção, paginada no servidor. Em setembro de 2026 a página chegou
// a 1.500 decisões num mês (e fevereiro, a 3.915 documentos), todas no mesmo
// HTML.
const POR_SECAO_NO_RESUMO = 20;
const POR_PAGINA = 100;
const SECAO_DECISOES = 'decisoes';

function parseSecao(secao?: string): string | null {
  return secao && /^[a-z_-]{1,40}$/.test(secao) ? secao : null;
}

function parsePagina(pagina?: string): number {
  const n = Number(pagina);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function trechoDaDecisao(summary: string | null, ementa: string): string {
  if (summary) return summary.length > LIMITE_RESUMO ? summary.slice(0, LIMITE_RESUMO) : summary;
  return ementa.length > 250 ? `${ementa.substring(0, 250)}...` : ementa;
}

export default async function NovidadesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { year, month } = parseMonth(params.mes);
  const secao = parseSecao(params.secao);
  const paginaPedida = parsePagina(params.pagina);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const whereDecisoes = {
    approvalStatus: { in: ['auto_approved', 'manually_approved'] },
    createdAt: { gte: startDate, lte: endDate },
  };
  const whereDocumentos = { uploadedAt: { gte: startDate, lte: endDate }, isPublic: true };
  const selectDecisao = { id: true, title: true, tribunalCode: true, summary: true, ementa: true, createdAt: true } as const;
  const selectDocumento = { id: true, title: true, description: true, category: true, uploadedAt: true } as const;

  type Decisao = { id: string; title: string; tribunalCode: string; summary: string | null; ementa: string; createdAt: Date };
  type Documento = { id: string; title: string; description: string | null; category: string; uploadedAt: Date };

  let decisoes: { itens: Decisao[]; total: number } = { itens: [], total: 0 };
  const documentosPorCategoria: Record<string, { itens: Documento[]; total: number }> = {};
  let pagina = 1;
  let totalPaginas = 1;
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
    if (secao) {
      // Lista completa de uma seção, paginada.
      const total = secao === SECAO_DECISOES
        ? await prisma.tribunalDecision.count({ where: whereDecisoes })
        : await prisma.document.count({ where: { ...whereDocumentos, category: secao } });
      totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
      pagina = Math.min(paginaPedida, totalPaginas);
      const skip = (pagina - 1) * POR_PAGINA;
      if (secao === SECAO_DECISOES) {
        const itens = await prisma.tribunalDecision.findMany({
          where: whereDecisoes, orderBy: { createdAt: 'desc' }, skip, take: POR_PAGINA, select: selectDecisao,
        });
        decisoes = { itens, total };
      } else if (total > 0) {
        const itens = await prisma.document.findMany({
          where: { ...whereDocumentos, category: secao }, orderBy: { uploadedAt: 'desc' }, skip, take: POR_PAGINA, select: selectDocumento,
        });
        documentosPorCategoria[secao] = { itens, total };
      }
    } else {
      // Resumo do mês: os primeiros itens de cada seção e o total de cada uma.
      const [itensDecisoes, totalDecisoes, categorias, posts, pubs, vids, atos] = await Promise.all([
        prisma.tribunalDecision.findMany({
          where: whereDecisoes, orderBy: { createdAt: 'desc' }, take: POR_SECAO_NO_RESUMO, select: selectDecisao,
        }),
        prisma.tribunalDecision.count({ where: whereDecisoes }),
        prisma.document.groupBy({
          by: ['category'], where: whereDocumentos, _count: { _all: true }, _max: { uploadedAt: true },
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
      decisoes = { itens: itensDecisoes, total: totalDecisoes };
      [blogPosts, publications, videos, legislativeActs] = [posts, pubs, vids, atos];

      // Categorias na ordem do documento mais recente, como antes da paginação.
      const ordenadas = [...categorias].sort(
        (a, b) => (b._max.uploadedAt?.getTime() ?? 0) - (a._max.uploadedAt?.getTime() ?? 0),
      );
      const itensPorCategoria = await Promise.all(ordenadas.map(({ category }) =>
        prisma.document.findMany({
          where: { ...whereDocumentos, category }, orderBy: { uploadedAt: 'desc' }, take: POR_SECAO_NO_RESUMO, select: selectDocumento,
        }),
      ));
      ordenadas.forEach(({ category, _count }, i) => {
        documentosPorCategoria[category] = { itens: itensPorCategoria[i], total: _count._all };
      });
    }
  } catch {
    // Database unavailable (e.g. CI build)
  }

  // A lista mostra de cada decisão só o resumo (limitado a três linhas) ou os
  // 250 primeiros caracteres da ementa. Enviar os textos inteiros ao cliente
  // levava a página a 6,8 MB de HTML em setembro de 2026 (1.494 decisões,
  // ementas de até 46 mil caracteres); agora vai só o trecho exibido.
  const tribunalDecisions = {
    total: decisoes.total,
    itens: decisoes.itens.map(({ summary, ementa, ...resto }) => ({
      ...resto,
      trecho: trechoDaDecisao(summary, ementa),
    })),
  };

  const totalItems = tribunalDecisions.total
    + Object.values(documentosPorCategoria).reduce((soma, { total }) => soma + total, 0);

  return (
    <NovidadesClient
      year={year}
      month={month}
      secao={secao}
      pagina={pagina}
      totalPaginas={totalPaginas}
      inicio={(pagina - 1) * POR_PAGINA}
      documentsByCategory={documentosPorCategoria}
      tribunalDecisions={tribunalDecisions}
      blogPosts={blogPosts}
      publications={publications}
      videos={videos}
      legislativeActs={legislativeActs}
      totalItems={totalItems}
    />
  );
}
