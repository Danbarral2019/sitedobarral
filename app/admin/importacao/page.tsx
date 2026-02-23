'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, FileSpreadsheet } from 'lucide-react';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { useTabFromUrl } from '@/hooks/use-tab-from-url';

const TCUManagerContent = dynamic(() => import('../tcu-manager/page'), {
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
});

const AGUImportContent = dynamic(() => import('../agu-import/page'), {
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
});

export default function ImportacaoPage() {
  const { activeTab, setTab } = useTabFromUrl('tcu');

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Importação de Atos</h1>
            <p className="text-gray-600 text-sm">Importe e gerencie acórdãos do TCU e documentos da AGU</p>
          </div>
        </div>
      </div>

      <Tabs defaultTab="tcu" activeTab={activeTab} onTabChange={setTab}>
        <TabList>
          <Tab id="tcu">TCU</Tab>
          <Tab id="agu">AGU</Tab>
        </TabList>
        <TabPanel id="tcu">
          <TCUManagerContent />
        </TabPanel>
        <TabPanel id="agu">
          <AGUImportContent />
        </TabPanel>
      </Tabs>
    </div>
  );
}
