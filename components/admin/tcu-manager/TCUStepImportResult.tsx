'use client';

import { CheckCircle, RefreshCw } from 'lucide-react';
import type { ImportResult } from '@/hooks/use-tcu-manager';

interface TCUStepImportResultProps {
  result: ImportResult;
  onReset: () => void;
}

export function TCUStepImportResult({ result, onReset }: TCUStepImportResultProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="text-center mb-8">
        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-900">Importação Concluída!</h2>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="text-center p-6 bg-green-50 rounded-lg">
          <div className="text-4xl font-bold text-green-600">{result.imported}</div>
          <div className="text-sm text-green-800 mt-2">Importados</div>
        </div>
        <div className="text-center p-6 bg-yellow-50 rounded-lg">
          <div className="text-4xl font-bold text-yellow-600">{result.duplicates}</div>
          <div className="text-sm text-yellow-800 mt-2">Duplicatas Puladas</div>
        </div>
        <div className="text-center p-6 bg-red-50 rounded-lg">
          <div className="text-4xl font-bold text-red-600">{result.failed}</div>
          <div className="text-sm text-red-800 mt-2">Falhas</div>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
          <p className="font-bold text-red-900 mb-2">Erros durante a importação:</p>
          <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
            {result.errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3">
        <a
          href="/admin/documentos"
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center font-medium"
        >
          Ver Documentos
        </a>
        <button
          onClick={onReset}
          className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          Nova Importação
        </button>
      </div>
    </div>
  );
}
