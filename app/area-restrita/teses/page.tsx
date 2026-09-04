import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { listarAcervo } from '@/lib/teses/consultas';
import { resolverAcessoDoDetalhe } from '@/app/(acervo)/teses/[chave]/acesso';
import AcervoTesesClient from './AcervoTesesClient';

export const metadata = {
  title: 'Acervo de teses do TCU',
  description:
    'Todas as teses destiladas dos acórdãos do TCU em licitações e contratos, com os trechos dos votos citantes que as sustentam.',
};

export default async function AcervoTesesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) redirect('/login');

  const payload = await verifyToken(token);
  if (!payload) redirect('/login');

  // Sessão válida não basta aqui: o acervo inteiro é conteúdo de acesso ativo,
  // e quem tem conta sem matrícula nem assinatura vai para os planos, não para
  // o login, que já passou.
  const comAcessoAtivo = await resolverAcessoDoDetalhe();
  if (!comAcessoAtivo) redirect('/planos');

  const teses = await listarAcervo();
  return <AcervoTesesClient teses={teses} />;
}
