'use client';

import { FileDown, Loader2, CheckSquare, X } from 'lucide-react';

interface PdfExportBarProps {
  selectedCount: number;
  totalDocumentCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onExport: () => void;
  isExporting: boolean;
}

export function PdfExportBar({
  selectedCount,
  totalDocumentCount,
  onSelectAll,
  onClearSelection,
  onExport,
  isExporting,
}: PdfExportBarProps) {
  if (totalDocumentCount === 0) return null;

  return (
    <div className="fixed bottom-0 lg:bottom-0 left-0 right-0 z-40 mb-16 lg:mb-0">
      <div className="bg-white border-t-2 border-brand-500 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Info */}
            <div className="flex items-center gap-2 text-sm min-w-0">
              <CheckSquare className="w-4 h-4 text-brand-600 flex-shrink-0" />
              <span className="text-ink-secondary truncate">
                <strong className="text-brand-700">{selectedCount}</strong>
                {' de '}
                <strong>{totalDocumentCount}</strong>
                {' '}
                <span className="hidden sm:inline">documentos selecionados</span>
                <span className="sm:hidden">selecionados</span>
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {selectedCount < totalDocumentCount && (
                <button
                  onClick={onSelectAll}
                  className="px-3 py-1.5 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-[6px] transition-colors"
                >
                  <span className="hidden sm:inline">Selecionar Todos</span>
                  <span className="sm:hidden">Todos</span>
                </button>
              )}
              {selectedCount > 0 && (
                <>
                  <button
                    onClick={onClearSelection}
                    className="px-3 py-1.5 text-xs font-medium text-ink-muted bg-surface-deep hover:bg-border-subtle rounded-[6px] transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span className="hidden sm:inline">Limpar</span>
                  </button>
                  <button
                    onClick={onExport}
                    disabled={isExporting}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed rounded-[6px] transition-colors flex items-center gap-1.5"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="hidden sm:inline">Gerando PDF...</span>
                        <span className="sm:hidden">Gerando...</span>
                      </>
                    ) : (
                      <>
                        <FileDown className="w-3.5 h-3.5" />
                        <span>PDF ({selectedCount})</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
