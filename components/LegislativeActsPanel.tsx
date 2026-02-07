'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Gavel, FileText, ExternalLink, Loader2, Search, X,
} from 'lucide-react';

type LegislativeAct = {
  id: string;
  type: string;
  fullNumber: string;
  title: string;
  ementa: string;
  summary?: string | null;
  issuer: string;
  publishDate: string;
  hierarchyLevel: number;
  leiArticles: string[];
  officialUrl?: string | null;
  pdfUrl?: string | null;
};

type TypeFilter = {
  type: string;
  count: number;
};

const TYPE_LABELS: Record<string, string> = {
  decreto: 'Decreto',
  portaria: 'Portaria',
  in: 'Instrução Normativa',
  'ordem-servico': 'Ordem de Serviço',
  lei: 'Lei',
  'medida-provisoria': 'Medida Provisória',
};

export default function LegislativeActsPanel() {
  const [acts, setActs] = useState<LegislativeAct[]>([]);
  const [typeFilters, setTypeFilters] = useState<TypeFilter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const fetchActs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search.trim()) params.set('search', search.trim());
      if (selectedType) params.set('type', selectedType);

      const response = await fetch(`/api/legislative-acts?${params}`);
      if (response.ok) {
        const data = await response.json();
        setActs(data.acts || []);
        if (data.filters?.types) {
          setTypeFilters(data.filters.types);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar atos normativos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedType]);

  useEffect(() => {
    const timer = setTimeout(fetchActs, 300);
    return () => clearTimeout(timer);
  }, [fetchActs]);

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Gavel className="w-10 h-10 text-amber-600" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">
              Atos Normativos Infralegais
            </h2>
            <p className="text-gray-600">
              Decretos, portarias e instruções normativas que regulamentam a Lei 14.133/2021
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por título, número ou ementa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Type filters */}
      {typeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedType(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              selectedType === null
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          {typeFilters.map((f) => (
            <button
              key={f.type}
              onClick={() => setSelectedType(selectedType === f.type ? null : f.type)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                selectedType === f.type
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {TYPE_LABELS[f.type] || f.type} ({f.count})
            </button>
          ))}
        </div>
      )}

      {/* Count */}
      {!isLoading && (
        <div className="mb-4">
          <span className="flex items-center gap-1 text-sm text-gray-600">
            <FileText className="w-4 h-4" />
            {acts.length} {acts.length === 1 ? 'ato normativo' : 'atos normativos'}
            {(search || selectedType) && ' encontrado(s)'}
          </span>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        </div>
      ) : acts.length === 0 ? (
        /* Empty state */
        <div className="text-center py-12">
          <Gavel className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum ato normativo encontrado.</p>
          {(search || selectedType) && (
            <button
              onClick={() => { setSearch(''); setSelectedType(null); }}
              className="mt-2 text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        /* Acts list */
        <div className="space-y-4">
          {acts.map((act) => (
            <div
              key={act.id}
              className="border-2 border-gray-200 rounded-xl p-5 hover:border-amber-300 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-lg">
                    {act.fullNumber}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {act.title}
                  </p>
                  <p className="text-sm text-gray-500 mt-2 line-clamp-3">
                    {act.ementa}
                  </p>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                      {TYPE_LABELS[act.type] || act.type}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {act.issuer}
                    </span>
                    {act.leiArticles && act.leiArticles.length > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                        Art. {act.leiArticles.slice(0, 5).join(', ')}{act.leiArticles.length > 5 ? '...' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  {act.officialUrl && (
                    <a
                      href={act.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Texto oficial
                    </a>
                  )}
                  {act.pdfUrl && (
                    <a
                      href={act.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      PDF
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
