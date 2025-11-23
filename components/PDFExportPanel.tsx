'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileDown, X, Loader2, CheckSquare, Square, Heart, Search, Sparkles } from 'lucide-react';
import { useSearchContext } from '@/contexts/SearchContext';

interface Document {
  id: string;
  title: string;
  description?: string;
  category: string;
  url?: string;
}

interface PDFExportPanelProps {
  documents: Document[];
  userName: string;
  userEmail: string;
  favoriteIds?: string[];
}

type ExportMode = 'search' | 'favorites' | 'custom';

export default function PDFExportPanel({ documents, userName, userEmail, favoriteIds = [] }: PDFExportPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [mode, setMode] = useState<ExportMode>('custom');

  const { searchState } = useSearchContext();

  // Helper functions (defined before useEffect that use them)
  const getCurrentModeDocuments = (): Document[] => {
    if (mode === 'search') {
      // Return ONLY documents from search results (filter out articles)
      return searchState.results
        .filter(result => result.resultType === 'document')
        .map(result => ({
          id: result.id,
          title: result.title,
          description: result.description,
          category: result.resultType === 'document' ? result.category : 'outro',
          url: result.url,
        }));
    } else if (mode === 'favorites') {
      // Return only favorite documents
      return documents.filter(doc => favoriteIds.includes(doc.id));
    } else {
      // Custom mode: all documents
      return documents;
    }
  };

  const selectOnlyFavorites = useCallback(() => {
    const validFavorites = favoriteIds.filter(id =>
      documents.some(doc => doc.id === id)
    );
    setSelectedIds(new Set(validFavorites));
  }, [favoriteIds, documents]);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    const currentDocuments = getCurrentModeDocuments();
    if (selectedIds.size === currentDocuments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentDocuments.map(d => d.id)));
    }
  };

  // Determine initial mode when panel opens
  useEffect(() => {
    if (showPanel) {
      // If there's an active search, default to search mode
      if (searchState.query && searchState.results.length > 0) {
        setMode('search');
        setSelectedIds(new Set(searchState.results.map(r => r.id)));
      } else if (favoriteIds.length > 0) {
        // If no search but has favorites, default to favorites mode
        setMode('favorites');
        selectOnlyFavorites();
      } else {
        // Otherwise, custom mode
        setMode('custom');
      }
    }
  }, [showPanel, searchState.query, searchState.results, favoriteIds.length, selectOnlyFavorites]);

  // Update selected documents when mode changes
  useEffect(() => {
    if (!showPanel) return;

    if (mode === 'search') {
      setSelectedIds(new Set(searchState.results.map(r => r.id)));
    } else if (mode === 'favorites') {
      selectOnlyFavorites();
    }
    // For custom mode, keep current selection
  }, [mode, showPanel, searchState.results, selectOnlyFavorites]);

  const handleOpenPanel = () => {
    setShowPanel(true);
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) {
      alert('Selecione pelo menos um documento');
      return;
    }

    try {
      setIsExporting(true);

      // Build search context if in search mode
      const searchContext = mode === 'search' && searchState.query ? {
        query: searchState.query,
        timestamp: searchState.timestamp?.toISOString() || new Date().toISOString(),
        searchType: searchState.searchType || 'local',
        aiResponse: searchState.aiResponse || undefined,
        relevanceScores: searchState.relevanceScores,
      } : undefined;

      const response = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: Array.from(selectedIds),
          mode,
          searchContext,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar PDF');
      }

      // Download do PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Different filename based on mode
      const fileName = mode === 'search'
        ? `relatorio-pesquisa-${new Date().toISOString().split('T')[0]}.pdf`
        : mode === 'favorites'
        ? `meus-favoritos-${new Date().toISOString().split('T')[0]}.pdf`
        : `documentos-${new Date().toISOString().split('T')[0]}.pdf`;

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Limpa seleção
      setSelectedIds(new Set());
      setShowPanel(false);

      const modeLabel = mode === 'search' ? 'Relatório de Pesquisa' : mode === 'favorites' ? 'Favoritos' : 'Documentos';
      alert(`PDF gerado com sucesso! ${selectedIds.size} documento(s) exportado(s).\n\nModo: ${modeLabel}`);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      alert('Erro ao exportar documentos para PDF. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!showPanel) {
    return (
      <button
        onClick={handleOpenPanel}
        className="fixed bottom-6 right-6 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 z-50 lg:bottom-8 lg:right-8"
        title="Exportar documentos para PDF"
      >
        <FileDown className="w-5 h-5" />
        <span className="font-medium">Exportar PDF</span>
      </button>
    );
  }

  const currentDocuments = getCurrentModeDocuments();
  const hasSearchResults = searchState.query && searchState.results.length > 0;

  return (
    <div className="fixed bottom-0 right-0 left-0 lg:left-80 bg-white border-t-2 border-blue-600 shadow-2xl z-50 max-h-[85vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileDown className="w-5 h-5 text-blue-600" />
              Exportar Documentos para PDF
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Selecione o modo de exportação e os documentos desejados
            </p>
          </div>
          <button
            onClick={() => setShowPanel(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Fechar painel"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="mt-4 flex gap-2 flex-wrap">
          {hasSearchResults && (
            <button
              onClick={() => setMode('search')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                mode === 'search'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                  : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              {searchState.searchType === 'ai' ? (
                <Sparkles className="w-4 h-4" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Resultados de Pesquisa ({searchState.results.length})
            </button>
          )}
          {favoriteIds.length > 0 && (
            <button
              onClick={() => setMode('favorites')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                mode === 'favorites'
                  ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-md'
                  : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              <Heart className="w-4 h-4 fill-current" />
              Favoritos ({favoriteIds.length})
            </button>
          )}
          <button
            onClick={() => setMode('custom')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
              mode === 'custom'
                ? 'bg-gradient-to-r from-gray-700 to-gray-900 text-white shadow-md'
                : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-gray-400'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Seleção Livre ({documents.length})
          </button>
        </div>

        {/* Mode-specific info */}
        {mode === 'search' && searchState.query && (
          <div className="mt-3 p-3 bg-purple-100 border border-purple-300 rounded-lg">
            <p className="text-sm text-purple-900">
              <strong>Pesquisa:</strong> &quot;{searchState.query}&quot;
              {searchState.searchType === 'ai' && ' (Busca com IA)'}
            </p>
            {searchState.timestamp && (
              <p className="text-xs text-purple-700 mt-1">
                {new Date(searchState.timestamp).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        )}

        {/* Stats e Ações */}
        <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-gray-700">
              {selectedIds.size} de {currentDocuments.length} selecionados
            </span>
            <button
              onClick={toggleAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              {selectedIds.size === currentDocuments.length ? (
                <>
                  <Square className="w-4 h-4" />
                  Desmarcar Todos
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4" />
                  Selecionar Todos
                </>
              )}
            </button>
          </div>

          <button
            onClick={handleExport}
            disabled={selectedIds.size === 0 || isExporting}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                Gerar PDF ({selectedIds.size})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Lista de Documentos */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {currentDocuments.map((doc) => {
            const isSelected = selectedIds.has(doc.id);
            const isFavorite = favoriteIds.includes(doc.id);
            const relevance = mode === 'search' ? searchState.relevanceScores[doc.id] : null;

            return (
              <div
                key={doc.id}
                onClick={() => toggleSelection(doc.id)}
                className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm text-gray-900 line-clamp-2 flex-1">
                        {doc.title}
                      </h4>
                      {isFavorite && (
                        <Heart className="w-4 h-4 text-red-600 fill-current flex-shrink-0" title="Favorito" />
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {doc.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {doc.category}
                      </span>
                      {relevance !== null && relevance !== undefined && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                          {Math.round(relevance * 100)}% relevante
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {currentDocuments.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <FileDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>
              {mode === 'search'
                ? 'Nenhum resultado de pesquisa para exportar'
                : mode === 'favorites'
                ? 'Você ainda não tem documentos favoritos'
                : 'Nenhum documento disponível para exportação'}
            </p>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="p-3 bg-gray-50 border-t text-xs text-gray-600 flex items-center gap-2">
        <span className="font-semibold">ℹ️ Informação:</span>
        <span>
          O PDF gerado incluirá marca d&apos;água com <strong>{userName}</strong> ({userEmail}) e data de exportação
          {mode === 'search' && searchState.aiResponse && ' + análise da IA'}
        </span>
      </div>
    </div>
  );
}
