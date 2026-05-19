'use client';

import { Download, ArrowRight, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import type { ValidationResult, SourceType } from '@/hooks/use-tcu-manager';

interface TCUStepValidationProps {
  validationResult: ValidationResult;
  sourceType: SourceType;
  isImporting: boolean;
  onBack: () => void;
  onDownloadForEdit: () => void;
  onProceedToReview: () => void;
  onImport: () => void;
}

export function TCUStepValidation({
  validationResult,
  sourceType,
  isImporting,
  onBack,
  onDownloadForEdit,
  onProceedToReview,
  onImport,
}: TCUStepValidationProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Resumo da Validação</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-gray-900">{validationResult.stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">{validationResult.stats.new}</div>
            <div className="text-sm text-green-800">Novos</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-3xl font-bold text-yellow-600">{validationResult.stats.duplicates}</div>
            <div className="text-sm text-yellow-800">Duplicatas</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-3xl font-bold text-red-600">{validationResult.stats.invalid}</div>
            <div className="text-sm text-red-800">Inválidos</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{validationResult.stats.valid}</div>
            <div className="text-sm text-blue-800">Válidos</div>
          </div>
        </div>
      </div>

      {validationResult.stats.duplicates > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-yellow-900">{validationResult.stats.duplicates} duplicata(s) detectada(s)</p>
              <p className="text-sm text-yellow-800">
                Estes documentos já existem no banco de dados e serão pulados automaticamente.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg p-6 flex gap-3">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
        >
          ← Voltar
        </button>
        <button
          onClick={onDownloadForEdit}
          className="px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          Baixar para Editar
        </button>
        {sourceType === 'tcu' ? (
          <button
            onClick={onProceedToReview}
            disabled={validationResult.stats.new === 0}
            className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <Sparkles className="w-5 h-5" />
            Revisar com IA ({validationResult.stats.new} docs)
            <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={onImport}
            disabled={isImporting || validationResult.stats.new === 0}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                Importar {validationResult.stats.new} Novos
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
