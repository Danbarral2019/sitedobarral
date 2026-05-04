'use client';

import dynamic from 'next/dynamic';
import { Loader2, BarChart3 } from 'lucide-react';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { useTabFromUrl } from '@/hooks/use-tab-from-url';

const AnalyticsContent = dynamic(() => import('../analytics/page'), {
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
});

const AnalyticsDocumentosContent = dynamic(() => import('../analytics-documentos/page'), {
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
});

const SearchAnalyticsContent = dynamic(() => import('../search-analytics/page'), {
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
});

export default function AnalyticsHubPage() {
  const { activeTab, setTab } = useTabFromUrl('geral');

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600 text-sm">Métricas gerais e análise de catalogação de documentos</p>
          </div>
        </div>
      </div>

      <Tabs defaultTab="geral" activeTab={activeTab} onTabChange={setTab}>
        <TabList>
          <Tab id="geral">Geral</Tab>
          <Tab id="catalogacao">Catalogação</Tab>
          <Tab id="busca-ia">Busca IA</Tab>
        </TabList>
        <TabPanel id="geral">
          <AnalyticsContent />
        </TabPanel>
        <TabPanel id="catalogacao">
          <AnalyticsDocumentosContent />
        </TabPanel>
        <TabPanel id="busca-ia">
          <SearchAnalyticsContent />
        </TabPanel>
      </Tabs>
    </div>
  );
}
