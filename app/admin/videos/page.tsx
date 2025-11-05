/**
 * Videos Admin Page (Server Component - Fase 7)
 */

import { ResourceListContainer } from '@/components/admin/ResourceListContainer';
import { fetchCourseVideosPaginated } from '@/lib/videos';
import { createVideosConfig } from './config';
import { VideosHeader } from './Header';
import AdminLayout from '@/components/AdminLayout';
import { courses } from '@/data/courses';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function VideosPage({ searchParams }: PageProps) {
  const videosConfig = createVideosConfig({
    courses: courses.map(c => ({ id: c.id, title: c.title }))
  });

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <VideosHeader />
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
            <ResourceListContainer
              searchParams={await searchParams}
              fetchData={fetchCourseVideosPaginated}
              config={videosConfig}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export const metadata = {
  title: 'Vídeos | Admin',
  description: 'Gerenciar vídeos dos cursos',
};
