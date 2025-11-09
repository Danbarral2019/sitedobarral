import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { LEI_14133_ARTIGOS as LEI_14133_ARTIGOS_FALLBACK } from '@/data/lei-14133-artigos';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ numero: string }>;
}): Promise<Metadata> {
  const { numero } = await params;

  // Buscar artigo do banco de dados
  let article = null;
  try {
    const dbArticle = await prisma.leiArticle.findUnique({
      where: { numero },
    });
    if (dbArticle) {
      article = {
        numero: dbArticle.numero,
        ementa: dbArticle.ementa,
        capitulo: dbArticle.capitulo,
        secao: dbArticle.secao || undefined,
        titulo: dbArticle.titulo || undefined,
        capituloCompleto: dbArticle.capituloCompleto || undefined,
      };
    }
  } catch (error) {
    console.error('Error fetching article for metadata:', error);
  }

  // Fallback para arquivo se banco falhar
  if (!article) {
    article = LEI_14133_ARTIGOS_FALLBACK[numero];
  }

  if (!article) {
    return {
      title: 'Artigo não encontrado',
    };
  }

  const title = `Artigo ${article.numero} - Lei 14.133/2021 | Prof. Daniel Barral`;
  const description = `${article.ementa} - Análise completa do artigo ${article.numero} da Nova Lei de Licitações e Contratos (Lei 14.133/2021). Materiais, comentários e jurisprudência.`;
  const url = `https://profbarral.com.br/artigo/${numero}`;

  return {
    title,
    description,
    keywords: [
      `lei 14133`,
      `artigo ${numero}`,
      `nova lei de licitações`,
      `licitações e contratos`,
      `lei de licitações`,
      `contratos administrativos`,
      article.capitulo,
      article.secao || '',
      'prof barral',
      'daniel barral',
    ].filter(Boolean),
    authors: [{ name: 'Prof. Daniel Barral' }],
    creator: 'Prof. Daniel Barral',
    publisher: 'Prof. Daniel Barral',
    openGraph: {
      title,
      description,
      url,
      siteName: 'Prof. Daniel Barral - Direito Administrativo',
      locale: 'pt_BR',
      type: 'article',
      images: [
        {
          url: 'https://profbarral.com.br/og-image-artigo.jpg',
          width: 1200,
          height: 630,
          alt: `Artigo ${numero} - Lei 14.133/2021`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: '@profbarral',
      images: ['https://profbarral.com.br/twitter-image-artigo.jpg'],
    },
    alternates: {
      canonical: url,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export default function ArtigoLayout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ numero: string }>;
}) {
  return <>{children}</>;
}
