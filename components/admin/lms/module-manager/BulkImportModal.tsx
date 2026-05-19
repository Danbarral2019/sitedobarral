'use client';

import { X, Loader2, Upload } from 'lucide-react';
import type { BulkPreviewItem } from '@/hooks/use-module-manager';

interface BulkImportModalProps {
  open: boolean;
  jsonInput: string;
  onJsonChange: (v: string) => void;
  preview: BulkPreviewItem[];
  error: string;
  importing: boolean;
  onClose: () => void;
  onValidate: () => void;
  onConfirm: () => void;
}

export function BulkImportModal({
  open,
  jsonInput,
  onJsonChange,
  preview,
  error,
  importing,
  onClose,
  onValidate,
  onConfirm,
}: BulkImportModalProps) {
  if (!open) return null;

  const placeholderExample = '[\n  { "title": "Aula 1", "description": "...", "estimatedMinutes": 30 },\n  { "title": "Aula 2", "description": "...", "estimatedMinutes": 45 }\n]';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl font-bold text-gray-900">Importar Aulas</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">JSON (array de aulas)</label>
            <textarea
              value={jsonInput}
              onChange={(e) => onJsonChange(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 font-mono text-sm"
              placeholder={placeholderExample}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <button
            onClick={onValidate}
            disabled={!jsonInput.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Validar e Visualizar
          </button>

          {preview.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200 rounded-lg">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Titulo</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Slug</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Descricao</th>
                      <th className="text-center py-2 px-3 font-semibold text-gray-700">Tempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((item, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 px-3 text-gray-900">{item.title}</td>
                        <td className="py-2 px-3 text-gray-500 font-mono text-xs">{item.slug}</td>
                        <td className="py-2 px-3 text-gray-600 truncate max-w-[200px]">
                          {item.description || '—'}
                        </td>
                        <td className="py-2 px-3 text-center text-gray-600">
                          {item.estimatedMinutes ? `${item.estimatedMinutes}min` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={onConfirm}
                  disabled={importing}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Confirmar Importacao ({preview.length} {preview.length === 1 ? 'aula' : 'aulas'})
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
