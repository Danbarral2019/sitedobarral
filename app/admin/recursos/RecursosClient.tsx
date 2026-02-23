'use client';

import { ReactNode } from 'react';
import { Globe } from 'lucide-react';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { useTabFromUrl } from '@/hooks/use-tab-from-url';
import { VideosClient } from '../videos/VideosClient';
import { PaginatedResult } from '@/lib/types/admin-list';
import { CourseVideo } from '@prisma/client';

interface RecursosClientProps {
  defaultTab: string;
  courses: Array<{ id: string; title: string }>;
  initialVideos: PaginatedResult<CourseVideo>;
  searchParams: { [key: string]: string | string[] | undefined };
  children: ReactNode;
}

export default function RecursosClient({
  defaultTab,
  courses,
  initialVideos,
  children,
}: RecursosClientProps) {
  const { activeTab, setTab } = useTabFromUrl(defaultTab);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recursos Externos</h1>
            <p className="text-gray-600 text-sm">Gerencie videos do YouTube e sites recomendados</p>
          </div>
        </div>
      </div>

      <Tabs defaultTab={defaultTab} activeTab={activeTab} onTabChange={setTab}>
        <TabList>
          <Tab id="videos">Videos</Tab>
          <Tab id="sites">Sites Recomendados</Tab>
        </TabList>
        <TabPanel id="videos">
          <VideosClient courses={courses} initialData={initialVideos} />
        </TabPanel>
        <TabPanel id="sites">
          {children}
        </TabPanel>
      </Tabs>
    </div>
  );
}
