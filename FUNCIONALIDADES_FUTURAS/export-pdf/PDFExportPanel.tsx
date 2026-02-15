'use client';

import { useState } from 'react';
import { FileDown, X, Loader2, CheckSquare, Square, Heart } from 'lucide-react';

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

export default function PDFExportPanel({ documents, userName, userEmail, favoriteIds = [] }: PDFExportPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

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
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map(d => d.id)));
    }
  };

  const selectOnlyFavorites = () => {
    const validFavorites = favoriteIds.filter(id =>
      documents.some(doc => doc.id === id)
    );
    setSelectedIds(new Set(validFavorites));
  };

  // Quando o painel é aberto, inicializar com favoritos se houver
  const handleOpenPanel = () => {
    setShowPanel(true);
    if (favoriteIds.length > 0 && selectedIds.size === 0) {
      selectOnlyFavorites();
    }
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) {
      alert('Selecione pelo menos um documento');
      return;
    }

    try {
      setIsExporting(true);

      const response = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: Array.from(selectedIds),
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
      a.download = `documentos-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Limpa seleção
      setSelectedIds(new Set());
      setShowPanel(false);

      alert(`PDF gerado com sucesso! ${selectedIds.size} documento(s) exportado(s).`);
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
        className="fixed bottom-6 right-6 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 z-50"
        title="Exportar documentos para PDF"
      >
        <FileDown className="w-5 h-5" />
        <span className="font-medium">Exportar PDF</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 left-0 bg-white border-t-2 border-blue-600 shadow-2xl z-50 max-h-[80vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileDown className="w-5 h-5 text-blue-600" />
              Exportar Documentos para PDF
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Selecione os documentos que deseja compilar em um único PDF com marca d&apos;água
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

        {/* Stats e Ações */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              {selectedIds.size} de {documents.length} selecionados
            </span>
            <button
              onClick={toggleAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              {selectedIds.size === documents.length ? (
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
            {favoriteIds.length > 0 && (
              <button
                onClick={selectOnlyFavorites}
                className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                title={`Selecionar apenas favoritos (${favoriteIds.length})`}
              >
                <Heart className="w-4 h-4 fill-current" />
                Apenas Favoritos ({favoriteIds.length})
              </button>
            )}
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
          {documents.map((doc) => {
            const isSelected = selectedIds.has(doc.id);
            const isFavorite = favoriteIds.includes(doc.id);

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
                        <Heart className="w-4 h-4 text-red-600 fill-current flex-shrink-0" aria-label="Favorito" />
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {doc.description}
                      </p>
                    )}
                    <div className="mt-2">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {doc.category}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {documents.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <FileDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum documento disponível para exportação</p>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="p-3 bg-gray-50 border-t text-xs text-gray-600 flex items-center gap-2">
        <span className="font-semibold">ℹ️ Informação:</span>
        <span>
          O PDF gerado incluirá marca d&apos;água com <strong>{userName}</strong> ({userEmail}) e data de exportação
        </span>
      </div>
    </div>
  );
}
