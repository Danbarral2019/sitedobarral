'use client';

import dynamic from 'next/dynamic';
import { Loader2, Sparkles } from 'lucide-react';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { useTabFromUrl } from '@/hooks/use-tab-from-url';

const ComentadaContent = dynamic(() => import('./comentada/ComentadaAdminClient'), {
  loading: () => <LoaderBlock />,
});
const ArtigosListPanel = dynamic(() => import('./ArtigosListPanel'), {
  loading: () => <LoaderBlock />,
});
const BulkLinkerContent = dynamic(() => import('./bulk-linker/page'), {
  loading: () => <LoaderBlock />,
});
const AnalyticsContent = dynamic(() => import('./analytics/page'), {
  loading: () => <LoaderBlock />,
});

function LoaderBlock() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );
}

export default function Lei14133HubClient() {
  const { activeTab, setTab } = useTabFromUrl('comentada');

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6 flex items-center gap-3">
        <Sparkles className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lei 14.133/2021</h1>
          <p className="text-sm text-gray-600">Editorial, vinculações em massa, analytics e editor de artigos</p>
        </div>
      </div>

      <Tabs defaultTab="comentada" activeTab={activeTab} onTabChange={setTab}>
        <TabList>
          <Tab id="comentada">Comentada (editorial)</Tab>
          <Tab id="artigos">Editor de artigos</Tab>
          <Tab id="bulk-linker">Vinculações em massa</Tab>
          <Tab id="analytics">Analytics</Tab>
        </TabList>

        <TabPanel id="comentada"><ComentadaContent /></TabPanel>
        <TabPanel id="artigos"><ArtigosListPanel /></TabPanel>
        <TabPanel id="bulk-linker"><BulkLinkerContent /></TabPanel>
        <TabPanel id="analytics"><AnalyticsContent /></TabPanel>
      </Tabs>
    </div>
  );
}
