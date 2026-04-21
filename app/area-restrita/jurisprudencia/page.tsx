import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import JurisprudenciaRestritaClient from './JurisprudenciaRestritaClient';

export const metadata = {
  title: 'Jurisprudência com IA',
  description:
    'Pesquise decisões de tribunais com filtros ricos e receba análises com IA fundamentadas nos acórdãos e na Lei 14.133/2021.',
};

export default async function JurisprudenciaRestritaPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) redirect('/login');

  const payload = await verifyToken(token);
  if (!payload) redirect('/login');

  return <JurisprudenciaRestritaClient />;
}
