import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lei 14.133/2021 - Todos os Artigos | Prof. Daniel Barral',
  description: 'Explore todos os 195 artigos da Nova Lei de Licitações e Contratos (Lei 14.133/2021) com materiais didáticos, jurisprudência e comentários do Prof. Daniel Barral.',
  keywords: [
    'lei 14133',
    'nova lei de licitações',
    'lei de licitações completa',
    'artigos lei 14133',
    'licitações e contratos',
    'contratos administrativos',
    'prof barral',
    'daniel barral',
    'direito administrativo',
  ],
  openGraph: {
    title: 'Lei 14.133/2021 - Todos os Artigos Comentados',
    description: 'Acesse todos os 195 artigos da Nova Lei de Licitações com análises, materiais e jurisprudência.',
    url: 'https://profbarral.com.br/artigos',
    siteName: 'Prof. Daniel Barral - Direito Administrativo',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lei 14.133/2021 - Todos os Artigos',
    description: 'Explore todos os 195 artigos da Nova Lei de Licitações com materiais didáticos.',
    creator: '@profbarral',
  },
  alternates: {
    canonical: 'https://profbarral.com.br/artigos',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function ArtigosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Lei 14.133/2021 - Todos os Artigos',
            description: 'Coleção completa dos 195 artigos da Nova Lei de Licitações e Contratos (Lei 14.133/2021)',
            url: 'https://profbarral.com.br/artigos',
            inLanguage: 'pt-BR',
            about: {
              '@type': 'Legislation',
              name: 'Lei 14.133/2021',
              description: 'Lei de Licitações e Contratos Administrativos',
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
              url: 'https://profbarral.com.br',
            },
            breadcrumb: {
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Início',
                  item: 'https://profbarral.com.br',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Lei 14.133/2021 - Artigos',
                  item: 'https://profbarral.com.br/artigos',
                },
              ],
            },
          }),
        }}
      />
    </>
  );
}
