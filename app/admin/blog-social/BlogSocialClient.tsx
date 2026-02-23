'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, PenSquare } from 'lucide-react';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { useTabFromUrl } from '@/hooks/use-tab-from-url';

const AssistenteSocialContent = dynamic(() => import('../assistente-social/page'), {
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
});

interface BlogSocialClientProps {
  defaultTab: string;
  searchParams: { [key: string]: string | string[] | undefined };
  children: ReactNode;
}

export default function BlogSocialClient({ defaultTab, children }: BlogSocialClientProps) {
  const { activeTab, setTab } = useTabFromUrl(defaultTab);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <PenSquare className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Blog & Social</h1>
            <p className="text-gray-600 text-sm">Gerencie posts do blog e publique nas redes sociais</p>
          </div>
        </div>
      </div>

      <Tabs defaultTab={defaultTab} activeTab={activeTab} onTabChange={setTab}>
        <TabList>
          <Tab id="blog">Blog</Tab>
          <Tab id="social">Redes Sociais</Tab>
        </TabList>
        <TabPanel id="blog">
          {children}
        </TabPanel>
        <TabPanel id="social">
          <AssistenteSocialContent />
        </TabPanel>
      </Tabs>
    </div>
  );
}
