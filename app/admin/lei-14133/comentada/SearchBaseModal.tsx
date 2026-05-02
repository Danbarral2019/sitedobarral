'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  slug?: string;
  snippet?: string;
}

type SearchKind =
  | { source: 'internal'; type: 'blog' | 'glossary' | 'legislative-act' | 'document' }
  | { source: 'admin-document' }
  | { source: 'admin-act' };

interface Props {
  kind: SearchKind;
  onSelect: (result: SearchResult) => void;
  onClose: () => void;
  title?: string;
}

export function SearchBaseModal({ kind, onSelect, onClose, title }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        let url = '';
        if (kind.source === 'internal') {
          url = `/api/admin/internal-search?type=${encodeURIComponent(kind.type)}&q=${encodeURIComponent(q)}`;
        } else if (kind.source === 'admin-document') {
          url = `/api/admin/internal-search?type=document&q=${encodeURIComponent(q)}`;
        } else {
          url = `/api/admin/internal-search?type=legislative-act&q=${encodeURIComponent(q)}`;
        }
        const r = await fetch(url);
        if (!r.ok) throw new Error('Falha');
        const data = await r.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [kind],
  );

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  const heading = title || (() => {
    if (kind.source === 'admin-document') return 'Vincular documento';
    if (kind.source === 'admin-act') return 'Vincular ato normativo';
    const labels = { blog: 'Buscar post do blog', glossary: 'Buscar termo do glossário', 'legislative-act': 'Buscar ato normativo', document: 'Buscar documento' } as const;
    return labels[kind.type];
  })();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-20">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col">
        <header className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
          <h3 className="font-bold text-lg">{heading}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-6 py-3 border-b flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite pra buscar…"
              autoFocus
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">{query ? 'Nenhum resultado' : 'Comece a digitar pra buscar'}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => onSelect(r)}
                    className="w-full text-left px-6 py-3 hover:bg-blue-50"
                  >
                    <p className="font-medium text-sm text-gray-900">{r.title}</p>
                    {r.snippet && <p className="text-xs text-gray-600 line-clamp-2 mt-1">{r.snippet}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
