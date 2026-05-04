'use client';

import dynamic from 'next/dynamic';
import { Loader2, Scale } from 'lucide-react';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { useTabFromUrl } from '@/hooks/use-tab-from-url';

const PendingReviewPanel = dynamic(() => import('./PendingReviewPanel'), {
  loading: () => <LoaderBlock />,
});
const TribunalDecisionsContent = dynamic(() => import('../tribunal-decisions/page'), {
  loading: () => <LoaderBlock />,
});
const TcuHighlightsContent = dynamic(() => import('../tcu-highlights/page'), {
  loading: () => <LoaderBlock />,
});
const TribunalHighlightsContent = dynamic(() => import('../tribunal-highlights/page'), {
  loading: () => <LoaderBlock />,
});
const ImportacaoContent = dynamic(() => import('../importacao/page'), {
  loading: () => <LoaderBlock />,
});

function LoaderBlock() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );
}

export default function TcuHubClient() {
  const { activeTab, setTab } = useTabFromUrl('acordaos');

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6 flex items-center gap-3">
        <Scale className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hub TCU</h1>
          <p className="text-sm text-gray-600">Acórdãos, destaques editoriais, importação e tribunais</p>
        </div>
      </div>

      <Tabs defaultTab="acordaos" activeTab={activeTab} onTabChange={setTab}>
        <TabList>
          <Tab id="acordaos">Acórdãos (revisão)</Tab>
          <Tab id="destaques">Destaques editoriais</Tab>
          <Tab id="tribunais">Tribunais (TCEs)</Tab>
          <Tab id="importar">Importar</Tab>
        </TabList>

        <TabPanel id="acordaos">
          <PendingReviewPanel />
        </TabPanel>
        <TabPanel id="destaques">
          <TcuHighlightsContent />
        </TabPanel>
        <TabPanel id="tribunais">
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold mb-3 text-gray-900">Decisões</h2>
              <TribunalDecisionsContent />
            </section>
            <section>
              <h2 className="text-lg font-semibold mb-3 text-gray-900">Destaques</h2>
              <TribunalHighlightsContent />
            </section>
          </div>
        </TabPanel>
        <TabPanel id="importar">
          <ImportacaoContent />
        </TabPanel>
      </Tabs>
    </div>
  );
}
