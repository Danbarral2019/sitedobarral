'use client';

interface BulkActionBarProps {
  count: number;
  action: string;
  onActionChange: (action: string) => void;
  onApply: () => void;
  onClear: () => void;
}

export function BulkActionBar({ count, action, onActionChange, onApply, onClear }: BulkActionBarProps) {
  return (
    <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-blue-900">
          {count} selecionado{count !== 1 ? 's' : ''}
        </span>

        <select
          value={action}
          onChange={(e) => onActionChange(e.target.value)}
          className="px-3 py-1.5 border-2 border-blue-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione uma acao</option>
          <option value="classify">Classificar Automaticamente (IA)</option>
          <option value="markReviewed">Marcar como Revisado</option>
          <option value="delete">Deletar selecionados</option>
        </select>

        <button
          onClick={onApply}
          disabled={!action}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Aplicar
        </button>

        <button
          onClick={onClear}
          className="ml-auto text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          Limpar selecao
        </button>
      </div>
    </div>
  );
}
