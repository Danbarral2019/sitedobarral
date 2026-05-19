'use client';

interface DOUBulkActionBarProps {
  selectedCount: number;
  isAllSelected: boolean;
  isProcessing: boolean;
  onToggleSelectAll: () => void;
  onClear: () => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
}

export function DOUBulkActionBar({
  selectedCount,
  isAllSelected,
  isProcessing,
  onToggleSelectAll,
  onClear,
  onBulkApprove,
  onBulkReject,
}: DOUBulkActionBarProps) {
  return (
    <div className="sticky top-0 z-20 bg-blue-600 text-white rounded-lg shadow-lg p-3 mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="font-medium text-sm">{selectedCount} selecionado(s)</span>
        <button onClick={onToggleSelectAll} className="text-xs underline hover:text-blue-200">
          {isAllSelected ? 'Desmarcar todos' : 'Selecionar todos'}
        </button>
        <button onClick={onClear} className="text-xs underline hover:text-blue-200">
          Limpar
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onBulkApprove}
          className="px-4 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors"
        >
          Aprovar Selecionados
        </button>
        <button
          onClick={onBulkReject}
          disabled={isProcessing}
          className="px-4 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isProcessing ? 'Processando...' : 'Rejeitar Selecionados'}
        </button>
      </div>
    </div>
  );
}
