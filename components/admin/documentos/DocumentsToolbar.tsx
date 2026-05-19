'use client';

import { FileText, RefreshCw, Download } from 'lucide-react';

interface DocumentsToolbarProps {
  loading: boolean;
  onRefresh: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
}

export function DocumentsToolbar({ loading, onRefresh, onExportJson, onExportCsv }: DocumentsToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Documentos Cadastrados</h2>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onRefresh}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1"
          title="Recarregar"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={onExportJson}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1"
          title="Exportar JSON"
        >
          <Download className="w-4 h-4" />
          JSON
        </button>
        <button
          onClick={onExportCsv}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1"
          title="Exportar CSV"
        >
          <Download className="w-4 h-4" />
          CSV
        </button>
      </div>
    </div>
  );
}
