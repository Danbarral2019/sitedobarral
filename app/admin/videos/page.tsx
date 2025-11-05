/**
 * Videos Admin Page (Server Component - Fix Serialização)
 *
 * Solução para problema de serialização Server/Client:
 * - Server: Busca dados serializáveis (courses)
 * - Client: Cria config com funções window.* (VideosClient)
 * - Nunca serializa funções entre fronteiras
 */

import { VideosClient } from './VideosClient';
import AdminLayout from '@/components/AdminLayout';
import { courses } from '@/data/courses';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function VideosPage({ searchParams }: PageProps) {
  // ✅ Server: Preparar dados serializáveis
  const coursesList = courses.map(c => ({ id: c.id, title: c.title }));
  const params = await searchParams;

  // ✅ Client Component cria config com funções
  return (
    <AdminLayout>
      <VideosClient courses={coursesList} searchParams={params} />
    </AdminLayout>
  );
}

export const metadata = {
  title: 'Vídeos | Admin',
  description: 'Gerenciar vídeos dos cursos',
};
