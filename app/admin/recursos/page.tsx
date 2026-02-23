import { fetchCourseVideosPaginated } from '@/lib/videos';
import { fetchSitesPaginated } from '@/lib/sites';
import { courses } from '@/data/courses';
import { sitesConfig, SitesHeader } from '../sites/config';
import { ResourceListContainer } from '@/components/admin/ResourceListContainer';
import RecursosClient from './RecursosClient';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RecursosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = typeof params.tab === 'string' ? params.tab : 'videos';

  // Fetch videos data server-side
  const normalizedParams = {
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
    courseId: typeof params.courseId === 'string' ? params.courseId : undefined,
    isActive: typeof params.isActive === 'string' ? params.isActive : undefined,
    search: typeof params.search === 'string' ? params.search : undefined,
  };

  const coursesList = courses.map(c => ({ id: c.id, title: c.title }));
  const videos = await fetchCourseVideosPaginated(normalizedParams);

  return (
    <RecursosClient
      defaultTab={tab}
      courses={coursesList}
      initialVideos={videos}
      searchParams={params}
    >
      {/* Sites tab - server rendered */}
      <div data-tab="sites">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            <SitesHeader />
            <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
              <ResourceListContainer
                searchParams={params}
                fetchData={fetchSitesPaginated}
                config={sitesConfig}
              />
            </div>
          </div>
        </div>
      </div>
    </RecursosClient>
  );
}

export const metadata = {
  title: 'Recursos Externos | Admin',
  description: 'Gerenciar videos e sites recomendados',
};
