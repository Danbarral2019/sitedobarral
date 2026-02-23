/**
 * Videos Admin Page (Server Component - Fix Correto)
 *
 * Padrão correto:
 * - Server Component busca TODOS os dados (including paginated list)
 * - Passa dados prontos para Client Component
 * - Client apenas gerencia interações (nunca data fetching)
 */

import { VideosClient } from './VideosClient';
import { courses } from '@/data/courses';
import { fetchCourseVideosPaginated } from '@/lib/videos';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function VideosPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Normalizar searchParams
  const normalizedParams = {
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
    courseId: typeof params.courseId === 'string' ? params.courseId : undefined,
    isActive: typeof params.isActive === 'string' ? params.isActive : undefined,
    search: typeof params.search === 'string' ? params.search : undefined,
  };

  // ✅ Server: Buscar TODOS os dados aqui
  const coursesList = courses.map(c => ({ id: c.id, title: c.title }));
  const videos = await fetchCourseVideosPaginated(normalizedParams);

  // ✅ Passar dados prontos para Client
  return (
      <VideosClient courses={coursesList} initialData={videos} />
  );
}

export const metadata = {
  title: 'Vídeos | Admin',
  description: 'Gerenciar vídeos dos cursos',
};
