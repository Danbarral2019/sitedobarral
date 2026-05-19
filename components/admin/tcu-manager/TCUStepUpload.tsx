'use client';

import { Upload, FileSpreadsheet, Download, Loader2, ArrowRight, FileText } from 'lucide-react';
import type { SourceType } from '@/hooks/use-tcu-manager';

interface TCUStepUploadProps {
  sourceType: SourceType;
  onSourceTypeChange: (type: SourceType) => void;
  selectedFile: File | null;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isConverting: boolean;
  isValidating: boolean;
  onConvertTCU: () => void;
  onUploadCustom: () => void;
  onBack: () => void;
}

export function TCUStepUpload({
  sourceType,
  onSourceTypeChange,
  selectedFile,
  onFileSelect,
  isConverting,
  isValidating,
  onConvertTCU,
  onUploadCustom,
  onBack,
}: TCUStepUploadProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Passo 1: Selecione o tipo de importação</h2>

      {!sourceType && (
        <div className="grid md:grid-cols-3 gap-4">
          <button
            onClick={() => onSourceTypeChange('tcu')}
            className="p-6 border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all"
          >
            <FileText className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <h3 className="font-bold text-gray-900 mb-2">Planilha TCU</h3>
            <p className="text-sm text-gray-600">Upload de arquivo exportado do site do TCU (.xls/.xlsx)</p>
          </button>

          <button
            onClick={() => onSourceTypeChange('custom')}
            className="p-6 border-2 border-gray-300 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all"
          >
            <FileSpreadsheet className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h3 className="font-bold text-gray-900 mb-2">Planilha Própria</h3>
            <p className="text-sm text-gray-600">Upload de arquivo já no formato do sistema</p>
          </button>

          <a
            href="/api/admin/import-excel/template"
            download
            className="p-6 border-2 border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all block text-center"
          >
            <Download className="w-12 h-12 text-purple-600 mx-auto mb-3" />
            <h3 className="font-bold text-gray-900 mb-2">Baixar Template</h3>
            <p className="text-sm text-gray-600">Crie sua própria planilha do zero</p>
          </a>
        </div>
      )}

      {sourceType && (
        <div className="space-y-6">
          <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
            <p className="text-sm text-blue-900">
              <strong>Tipo selecionado:</strong>{' '}
              {sourceType === 'tcu' ? 'Planilha TCU (conversão automática)' : 'Planilha própria (formato do sistema)'}
            </p>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
            <input type="file" accept=".xls,.xlsx" onChange={onFileSelect} className="hidden" id="file-upload" />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              {selectedFile ? (
                <div>
                  <p className="text-lg font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                  <p className="text-xs text-blue-600 mt-2">Clique para escolher outro arquivo</p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-medium text-gray-900">Clique para selecionar arquivo</p>
                  <p className="text-sm text-gray-600">Formatos: .xls, .xlsx</p>
                </div>
              )}
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Voltar
            </button>
            <button
              onClick={sourceType === 'tcu' ? onConvertTCU : onUploadCustom}
              disabled={!selectedFile || isConverting || isValidating}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
            >
              {isConverting || isValidating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isConverting ? 'Convertendo...' : 'Validando...'}
                </>
              ) : (
                <>
                  {sourceType === 'tcu' ? 'Converter e Validar' : 'Validar Planilha'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
