'use client';

import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import {
  Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle,
  Loader2, ArrowRight, Info, FileText, AlertTriangle, RefreshCw
} from 'lucide-react';

type Step = 1 | 2 | 3;
type SourceType = 'tcu' | 'custom' | null;

interface ValidationResult {
  stats: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
    new: number;
  };
  documents: Array<{
    title: string;
    description: string;
    category: string;
    isValid: boolean;
    isDuplicate: boolean;
    duplicateInfo?: {
      id: string;
      title: string;
      uploadedAt: string;
    };
    errors: string[];
    warnings: string[];
    rowIndex: number;
    rawData: Record<string, unknown>;
  }>;
}

interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  failed: number;
  errors: string[];
  duplicateList: string[];
  importedList: string[];
}

export default function TCUManagerPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [sourceType, setSourceType] = useState<SourceType>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Etapa 1: Upload e Conversão
  const [isConverting, setIsConverting] = useState(false);
  const [convertedData, setConvertedData] = useState<any>(null);

  // Etapa 2: Validação e Detecção de Duplicatas
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Etapa 3: Importação
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [error, setError] = useState<string | null>(null);

  // === ETAPA 1: UPLOAD E CONVERSÃO ===

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleConvertTCU = async () => {
    if (!selectedFile) return;

    try {
      setIsConverting(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/admin/tcu-manager/convert', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao converter');
      }

      const data = await response.json();
      setConvertedData(data);

      // Agora valida automaticamente
      await validateDocuments(selectedFile, 'tcu');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsConverting(false);
    }
  };

  const validateDocuments = async (file: File, type: 'tcu' | 'custom') => {
    try {
      setIsValidating(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceType', type);

      const response = await fetch('/api/admin/tcu-manager/validate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao validar');
      }

      const data = await response.json();
      setValidationResult(data);
      setCurrentStep(2);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsValidating(false);
    }
  };

  const handleUploadCustom = async () => {
    if (!selectedFile) return;
    await validateDocuments(selectedFile, 'custom');
  };

  // === ETAPA 2: VALIDAÇÃO ===

  const handleDownloadForEdit = () => {
    // TODO: Implementar download do Excel com dados validados para edição manual
    alert('Funcionalidade de download para edição será implementada');
  };

  // === ETAPA 3: IMPORTAÇÃO ===

  const handleImport = async () => {
    if (!validationResult) return;

    try {
      setIsImporting(true);
      setError(null);

      // Prepara documentos para importação (somente os válidos e não-duplicados)
      const documentsToImport = validationResult.documents
        .filter(doc => doc.isValid)
        .map(doc => ({
          title: doc.rawData['Titulo'] || doc.rawData['titulo'] || doc.title,
          description: doc.rawData['Descricao'] || doc.rawData['descricao'] || doc.description,
          category: doc.rawData['Categoria'] || doc.rawData['categoria'] || doc.category,
          course: doc.rawData['Curso'] || doc.rawData['curso'] || '',
          tags: doc.rawData['Tags'] || doc.rawData['tags'] || '',
          publico: doc.rawData['Publico'] || doc.rawData['publico'] || 'SIM',
          url: doc.rawData['URL'] || doc.rawData['url'] || '',
          arquivo: doc.rawData['Arquivo'] || doc.rawData['arquivo'] || '',
          isDuplicate: doc.isDuplicate,
        }));

      const response = await fetch('/api/admin/tcu-manager/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: documentsToImport }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao importar');
      }

      const data = await response.json();
      setImportResult(data.results);
      setCurrentStep(3);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setSourceType(null);
    setSelectedFile(null);
    setConvertedData(null);
    setValidationResult(null);
    setImportResult(null);
    setError(null);
  };

  // === RENDER ===

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-blue-600" />
            Gerenciador de Acórdãos TCU
          </h1>
          <p className="text-gray-600 mt-2">
            Importe, converta e gerencie acórdãos com detecção automática de duplicatas
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-center">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                currentStep === step
                  ? 'bg-blue-100 text-blue-800 font-bold'
                  : currentStep > step
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep === step
                    ? 'bg-blue-600 text-white'
                    : currentStep > step
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {currentStep > step ? <CheckCircle className="w-5 h-5" /> : step}
                </div>
                <span className="hidden sm:inline">
                  {step === 1 ? 'Upload' : step === 2 ? 'Revisão' : 'Importação'}
                </span>
              </div>
              {step < 3 && (
                <div className="w-12 h-1 bg-gray-300 mx-2" />
              )}
            </div>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-900">Erro</p>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 1: UPLOAD E CONVERSÃO */}
        {currentStep === 1 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Passo 1: Selecione o tipo de importação
            </h2>

            {!sourceType && (
              <div className="grid md:grid-cols-3 gap-4">
                {/* Opção TCU */}
                <button
                  onClick={() => setSourceType('tcu')}
                  className="p-6 border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <FileText className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                  <h3 className="font-bold text-gray-900 mb-2">Planilha TCU</h3>
                  <p className="text-sm text-gray-600">
                    Upload de arquivo exportado do site do TCU (.xls/.xlsx)
                  </p>
                </button>

                {/* Opção Custom */}
                <button
                  onClick={() => setSourceType('custom')}
                  className="p-6 border-2 border-gray-300 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all"
                >
                  <FileSpreadsheet className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <h3 className="font-bold text-gray-900 mb-2">Planilha Própria</h3>
                  <p className="text-sm text-gray-600">
                    Upload de arquivo já no formato do sistema
                  </p>
                </button>

                {/* Opção Template */}
                <a
                  href="/api/admin/import-excel/template"
                  download
                  className="p-6 border-2 border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all block text-center"
                >
                  <Download className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                  <h3 className="font-bold text-gray-900 mb-2">Baixar Template</h3>
                  <p className="text-sm text-gray-600">
                    Crie sua própria planilha do zero
                  </p>
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

                {/* File Upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    accept=".xls,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
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
                        <p className="text-lg font-medium text-gray-900">
                          Clique para selecionar arquivo
                        </p>
                        <p className="text-sm text-gray-600">
                          Formatos: .xls, .xlsx
                        </p>
                      </div>
                    )}
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSourceType(null);
                      setSelectedFile(null);
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={sourceType === 'tcu' ? handleConvertTCU : handleUploadCustom}
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
        )}

        {/* ETAPA 2: VALIDAÇÃO E REVISÃO */}
        {currentStep === 2 && validationResult && (
          <div className="space-y-6">
            {/* Stats Card */}
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

            {/* Duplicates Warning */}
            {validationResult.stats.duplicates > 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-yellow-900">
                      {validationResult.stats.duplicates} duplicata(s) detectada(s)
                    </p>
                    <p className="text-sm text-yellow-800">
                      Estes documentos já existem no banco de dados e serão pulados automaticamente.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="bg-white rounded-xl shadow-lg p-6 flex gap-3">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                ← Voltar
              </button>
              <button
                onClick={handleDownloadForEdit}
                className="px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Baixar para Editar
              </button>
              <button
                onClick={handleImport}
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
            </div>
          </div>
        )}

        {/* ETAPA 3: RESULTADO DA IMPORTAÇÃO */}
        {currentStep === 3 && importResult && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-8">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900">Importação Concluída!</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="text-center p-6 bg-green-50 rounded-lg">
                <div className="text-4xl font-bold text-green-600">{importResult.imported}</div>
                <div className="text-sm text-green-800 mt-2">Importados</div>
              </div>
              <div className="text-center p-6 bg-yellow-50 rounded-lg">
                <div className="text-4xl font-bold text-yellow-600">{importResult.duplicates}</div>
                <div className="text-sm text-yellow-800 mt-2">Duplicatas Puladas</div>
              </div>
              <div className="text-center p-6 bg-red-50 rounded-lg">
                <div className="text-4xl font-bold text-red-600">{importResult.failed}</div>
                <div className="text-sm text-red-800 mt-2">Falhas</div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                <p className="font-bold text-red-900 mb-2">Erros durante a importação:</p>
                <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                  {importResult.errors.map((err, idx) => (
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
                onClick={handleReset}
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Nova Importação
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
