'use client';

interface TribunalBulkActionsBarProps {
  selectedCount: number;
  totalVisible: number;
  isProcessing: boolean;
  onToggleSelectAll: () => void;
  onClear: () => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
}

export function TribunalBulkActionsBar({
  selectedCount,
  totalVisible,
  isProcessing,
  onToggleSelectAll,
  onClear,
  onBulkApprove,
  onBulkReject,
}: TribunalBulkActionsBarProps) {
  return (
    <div className="sticky top-0 z-20 bg-blue-600 text-white p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="font-medium text-sm">{selectedCount} selecionada(s)</span>
        <button onClick={onToggleSelectAll} className="text-xs underline hover:text-blue-200">
          {selectedCount === totalVisible ? 'Desmarcar todas' : 'Selecionar todas'}
        </button>
        <button onClick={onClear} className="text-xs underline hover:text-blue-200">
          Limpar
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onBulkApprove}
          disabled={isProcessing}
          className="px-4 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isProcessing ? 'Processando...' : 'Aprovar Selecionadas'}
        </button>
        <button
          onClick={onBulkReject}
          disabled={isProcessing}
          className="px-4 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          Rejeitar Selecionadas
        </button>
      </div>
    </div>
  );
}
