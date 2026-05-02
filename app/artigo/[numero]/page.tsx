import { redirect, permanentRedirect } from 'next/navigation';

/**
 * /artigo/[numero] → redirecionamento permanente para /lei-14133?artigo=N
 *
 * A apresentação de cada artigo agora vive na própria página da Lei 14.133
 * Comentada (sidebar + main column). Esta rota fica como redirect 301 para
 * preservar SEO de links externos antigos.
 */

export default async function ArtigoRedirect({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { numero } = await params;
  const safe = String(numero).trim();
  if (!safe || !/^\d+(-[A-Z])?$/.test(safe)) {
    redirect('/lei-14133');
  }
  permanentRedirect(`/lei-14133?artigo=${encodeURIComponent(safe)}`);
}
