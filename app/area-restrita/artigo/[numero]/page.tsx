import { redirect } from 'next/navigation';

/**
 * /area-restrita/artigo/[numero] → /area-restrita/lei-comentada?artigo=N
 *
 * A apresentação dos artigos foi unificada em /area-restrita/lei-comentada,
 * que mostra a sidebar de Estrutura da Lei + main column do artigo
 * selecionado, com Histórico/Favoritos preservados.
 */

export default async function ArtigoRedirect({
 params,
}: {
 params: Promise<{ numero: string }>;
}) {
 const { numero } = await params;
 const safe = String(numero).trim();
 if (!safe || !/^\d+(-[A-Z])?$/.test(safe)) {
 redirect('/area-restrita/lei-comentada');
 }
 redirect(`/area-restrita/lei-comentada?artigo=${encodeURIComponent(safe)}`);
}
