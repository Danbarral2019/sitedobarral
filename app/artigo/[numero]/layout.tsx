import { Metadata } from 'next';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ numero: string }>;
}): Promise<Metadata> {
  const { numero } = await params;
  const article = LEI_14133_ARTIGOS[numero];

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
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ numero: string }>;
}) {
  return (
    <>
      {children}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'LegalDocument',
            name: `Artigo ${params} - Lei 14.133/2021`,
            description: LEI_14133_ARTIGOS[params as any]?.ementa,
            url: `https://profbarral.com.br/artigo/${params}`,
            inLanguage: 'pt-BR',
            isPartOf: {
              '@type': 'Legislation',
              name: 'Lei 14.133/2021',
              legislationIdentifier: 'Lei 14.133/2021',
              legislationJurisdiction: {
                '@type': 'Country',
                name: 'Brasil',
              },
            },
            publisher: {
              '@type': 'Person',
              name: 'Prof. Daniel Barral',
              jobTitle: 'Professor de Direito Administrativo',
            },
          }),
        }}
      />
    </>
  );
}
