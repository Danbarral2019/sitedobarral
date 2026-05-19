'use client';

import { X, Loader2, Trash2 } from 'lucide-react';
import type { DeleteTarget } from '@/hooks/use-module-manager';

interface DeleteConfirmationModalProps {
  target: DeleteTarget | null;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeleteConfirmationModal({ target, onCancel, onConfirm, isDeleting }: DeleteConfirmationModalProps) {
  if (!target) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-gray-900">
            Excluir {target.type === 'module' ? 'Modulo' : 'Licao'}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-gray-900">
            Tem certeza que deseja excluir <strong>{target.title}</strong>?
          </p>
          {target.type === 'module' && (
            <p className="text-sm text-red-600 mt-2">Todas as licoes deste modulo tambem serao excluidas.</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
