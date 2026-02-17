import { useState, useMemo, useEffect, useCallback } from 'react';
import type { DocumentResult } from '@/lib/types/global-search';

interface SearchResult {
  type: string;
  data: unknown;
}

export function useSearchPdfExport(
  searchResults: SearchResult[],
  searchQuery: string,
  aiAnswer: string | null | undefined,
) {
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const documentResults = useMemo(() => {
    return searchResults
      .filter(r => r.type === 'document')
      .map(r => r.data as DocumentResult);
  }, [searchResults]);

  // Clear selection when search changes
  useEffect(() => {
    setSelectedDocIds(new Set());
  }, [searchQuery]);

  const toggleDocSelect = useCallback((id: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllDocs = useCallback(() => {
    setSelectedDocIds(new Set(documentResults.map(d => d.id)));
  }, [documentResults]);

  const clearDocSelection = useCallback(() => setSelectedDocIds(new Set()), []);

  const handleExportPdf = useCallback(async () => {
    if (selectedDocIds.size === 0) return;
    setIsExporting(true);
    try {
      const res = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: Array.from(selectedDocIds),
          mode: 'search',
          searchContext: {
            query: searchQuery,
            aiResponse: aiAnswer || undefined,
            searchType: aiAnswer ? 'ai' : 'local',
            timestamp: new Date().toISOString(),
          },
        }),
      });
      if (!res.ok) throw new Error('Erro ao gerar PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documentos-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
    } finally {
      setIsExporting(false);
    }
  }, [selectedDocIds, searchQuery, aiAnswer]);

  return {
    selectedDocIds,
    isExporting,
    documentResults,
    toggleDocSelect,
    selectAllDocs,
    clearDocSelection,
    handleExportPdf,
  };
}
