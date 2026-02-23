'use client';

import dynamic from 'next/dynamic';
import { Loader2, FileText } from 'lucide-react';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { useTabFromUrl } from '@/hooks/use-tab-from-url';
import AdicionarDocumentosClient from '../adicionar-documentos/AdicionarDocumentosClient';

const DocumentosContent = dynamic(() => import('../documentos/page'), {
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
});

interface SerializedDocument {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: string;
  url: string;
  uploadedAt: string;
  summary?: string | null;
  metaTcu?: { numeroAcordao?: string | null } | null;
  reviewedBy?: string | null;
  douData?: string | null;
}

interface SerializedUpload {
  id: string;
  title: string;
  category: string;
  type: string;
  courseId: string | null;
  isPublic: boolean;
  uploadedAt: string;
  isCommon: boolean;
}

interface DocsClientProps {
  defaultTab: string;
  pendingDocuments: SerializedDocument[];
  pendingPagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  recentUploads: SerializedUpload[];
}

export default function DocsClient({
  defaultTab,
  pendingDocuments,
  pendingPagination,
  recentUploads,
}: DocsClientProps) {
  const { activeTab, setTab } = useTabFromUrl(defaultTab);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
            <p className="text-gray-600 text-sm">Adicione novos documentos ou gerencie os existentes</p>
          </div>
        </div>
      </div>

      <Tabs defaultTab={defaultTab} activeTab={activeTab} onTabChange={setTab}>
        <TabList>
          <Tab id="central">Central</Tab>
          <Tab id="gerenciar">Gerenciar</Tab>
        </TabList>
        <TabPanel id="central">
          <AdicionarDocumentosClient
            autoImports={pendingDocuments}
            autoImportsPagination={pendingPagination}
            recentUploads={recentUploads}
          />
        </TabPanel>
        <TabPanel id="gerenciar">
          <DocumentosContent />
        </TabPanel>
      </Tabs>
    </div>
  );
}
