'use client';

import {
  RefreshCw, Search, Tag, Calendar, Sparkles, ExternalLink,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
} from 'lucide-react';

export interface AutoImportDocument {
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
}

interface AutoImportsListProps {
  docs: AutoImportDocument[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
  collapsed: boolean;
  onToggle: () => void;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  onPageChange: (page: number) => void;
}

export function AutoImportsList({
  docs,
  pagination,
  collapsed,
  onToggle,
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  onPageChange,
}: AutoImportsListProps) {
  const filtered = searchTerm
    ? docs.filter(
        (doc) =>
          doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.metaTcu?.numeroAcordao?.includes(searchTerm),
      )
    : docs;

  return (
    <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
      >
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6" />
          <span className="text-lg font-bold">Importações Automáticas Recentes (7 dias)</span>
          {pagination.total > 0 && (
            <span className="px-2 py-1 bg-white/20 rounded-full text-sm">{pagination.total}</span>
          )}
        </div>
        {collapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
      </button>

      {!collapsed && (
        <div className="p-6">
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Buscar por titulo ou numero..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">Todas categorias</option>
              <option value="acordao">Acórdão TCU</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <RefreshCw className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Nenhuma importação automática nos últimos 7 dias</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {filtered.map((doc) => (
                <div key={doc.id} className="p-4 rounded-lg border-2 border-gray-200 hover:border-indigo-300 transition">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900 truncate">{doc.title}</h4>
                        {doc.metaTcu?.numeroAcordao && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-mono flex-shrink-0">
                            {doc.metaTcu.numeroAcordao}
                          </span>
                        )}
                      </div>
                      {doc.description && <p className="text-sm text-gray-600 truncate mt-1">{doc.description}</p>}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                          <Tag className="w-3 h-3" /> {doc.category}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
                        </span>
                        {doc.summary && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Resumo IA
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded flex-shrink-0"
                      title="Abrir documento"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <span className="text-sm text-gray-600">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => onPageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onPageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
