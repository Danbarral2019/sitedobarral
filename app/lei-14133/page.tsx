import { Metadata } from 'next';
import LeiComentadaClient from './LeiComentadaClient';
import { metadadosDoArtigo } from '@/lib/lei-14133/metadados-artigo';
import { artigoInicial } from '@/lib/lei-14133/artigo-inicial';

const METADADOS_DA_LEI: Metadata = {
  title: 'Lei 14.133/2021 Comentada',
  description:
    'Lei nº 14.133, de 1º de abril de 2021. Nova Lei de Licitações e Contratos Administrativos — texto integral dos artigos com regulamentações em destaque, jurisprudência, pareceres e enunciados interpretativos relacionados.',
  alternates: { canonical: '/lei-14133' },
};

// Com ?artigo=N, a página exibe o artigo e declara título e canonical dele,
// para que cada artigo seja indexado; sem o parâmetro, vale o da lei inteira.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ artigo?: string | string[] }>;
}): Promise<Metadata> {
  const { artigo } = await searchParams;
  return metadadosDoArtigo(typeof artigo === 'string' ? artigo : undefined) ?? METADADOS_DA_LEI;
}

export default async function LeiPage({
  searchParams,
}: {
  searchParams: Promise<{ artigo?: string | string[] }>;
}) {
  const { artigo } = await searchParams;
  const inicial = await artigoInicial(typeof artigo === 'string' ? artigo : undefined);
  return <LeiComentadaClient artigoInicial={inicial} />;
}
