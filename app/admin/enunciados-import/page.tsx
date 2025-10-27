'use client';

import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import {
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader,
  Eye,
  X,
  Check,
} from 'lucide-react';

interface EnunciadoMetadata {
  numeroPropostaPublica?: string;
  artigos: string[];
  keywords: string[];
}

interface EnunciadoClassification {
  success: boolean;
  titulo: string;
  descricao: string;
  categoria: string;
  cursos: string[];
  tags: string[];
  artigos: string[];
  confianca: number;
  raciocinio: string;
}

interface EnunciadoExtracted {
  numero: number;
  titulo: string;
  texto: string;
  fonte: string;
  metadados: EnunciadoMetadata;
  classification?: EnunciadoClassification;
}

interface ParseResult {
  success: boolean;
  fonte: string;
  totalEnunciados: number;
  enunciados: EnunciadoExtracted[];
}

export default function EnunciadosImportPage() {
  // Estados
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState('');
  const [selectedEnunciados, setSelectedEnunciados] = useState<Set<number>>(new Set());
  const [expandedEnunciado, setExpandedEnunciado] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Upload de arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      if (!validTypes.includes(file.type)) {
        setError('Por favor, selecione um arquivo PDF ou DOCX');
        return;
      }
      setSelectedFile(file);
      setError('');
      setParseResult(null);
      setSelectedEnunciados(new Set());
    }
  };

  // Extrair e classificar enunciados
  const handleExtract = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('autoClassify', 'true');

      const response = await fetch('/api/admin/enunciados-import/parse', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao processar PDF');
      }

      const data: ParseResult = await response.json();
      setParseResult(data);

      // Seleciona todos por padrão
      const allNumbers = new Set(data.enunciados.map(e => e.numero));
      setSelectedEnunciados(allNumbers);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle seleção de enunciado
  const toggleEnunciado = (numero: number) => {
    const newSelected = new Set(selectedEnunciados);
    if (newSelected.has(numero)) {
      newSelected.delete(numero);
    } else {
      newSelected.add(numero);
    }
    setSelectedEnunciados(newSelected);
  };

  // Selecionar/desselecionar todos
  const toggleSelectAll = () => {
    if (!parseResult) return;

    if (selectedEnunciados.size === parseResult.enunciados.length) {
      setSelectedEnunciados(new Set());
    } else {
      const allNumbers = new Set(parseResult.enunciados.map(e => e.numero));
      setSelectedEnunciados(allNumbers);
    }
  };

  // Importar enunciados selecionados
  const handleImport = async () => {
    if (!parseResult || selectedEnunciados.size === 0) return;

    setIsImporting(true);
    setError('');

    try {
      const enunciadosToImport = parseResult.enunciados.filter(e =>
        selectedEnunciados.has(e.numero)
      );

      const response = await fetch('/api/admin/enunciados-import/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enunciados: enunciadosToImport,
          fonte: parseResult.fonte,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao importar');
      }

      const data = await response.json();
      alert(`✅ ${data.imported} enunciados importados com sucesso!`);

      // Reset
      setSelectedFile(null);
      setParseResult(null);
      setSelectedEnunciados(new Set());

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            Importar Enunciados
          </h1>
          <p className="text-gray-600 mt-2">
            Extraia e importe enunciados de PDFs ou DOCX (IBDA, INCP, CJF)
          </p>
        </div>

        {/* Upload Section */}
        {!parseResult && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">1. Selecione o Arquivo (PDF ou DOCX)</h2>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />

              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />

              <label
                htmlFor="file-upload"
                className="cursor-pointer inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Escolher PDF ou DOCX
              </label>

              {selectedFile && (
                <p className="mt-4 text-sm text-gray-700">
                  <strong>Arquivo:</strong> {selectedFile.name}
                </p>
              )}
            </div>

            {selectedFile && (
              <button
                onClick={handleExtract}
                disabled={isProcessing}
                className="mt-6 w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Processando PDF...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Extrair e Classificar Enunciados
                  </>
                )}
              </button>
            )}

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Results Section */}
        {parseResult && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-lg font-bold text-blue-900 mb-2">
                ✅ Extração Concluída
              </h2>
              <p className="text-blue-800">
                <strong>{parseResult.totalEnunciados} enunciados</strong> encontrados em{' '}
                <strong>{parseResult.fonte}</strong>
              </p>
              <p className="text-sm text-blue-700 mt-2">
                {selectedEnunciados.size} selecionados para importação
              </p>
            </div>

            {/* Selection Controls */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex justify-between items-center">
              <button
                onClick={toggleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {selectedEnunciados.size === parseResult.enunciados.length
                  ? '☐ Desselecionar Todos'
                  : '☑ Selecionar Todos'}
              </button>

              <button
                onClick={handleImport}
                disabled={isImporting || selectedEnunciados.size === 0}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Importar {selectedEnunciados.size} Selecionados
                  </>
                )}
              </button>
            </div>

            {/* Enunciados List */}
            <div className="space-y-4">
              {parseResult.enunciados.map((enunciado) => {
                const isSelected = selectedEnunciados.has(enunciado.numero);
                const isExpanded = expandedEnunciado === enunciado.numero;

                return (
                  <div
                    key={enunciado.numero}
                    className={`bg-white rounded-lg shadow-sm border-2 transition-colors ${
                      isSelected ? 'border-blue-500' : 'border-gray-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEnunciado(enunciado.numero)}
                          className="mt-1 w-5 h-5 text-blue-600 rounded"
                        />

                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900">
                            {enunciado.classification?.titulo || enunciado.titulo}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {enunciado.classification?.descricao || enunciado.texto.substring(0, 150) + '...'}
                          </p>

                          {/* Metadados */}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {enunciado.classification && (
                              <>
                                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                                  {enunciado.classification.categoria}
                                </span>
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  Confiança: {enunciado.classification.confianca}%
                                </span>
                              </>
                            )}
                            {enunciado.metadados.artigos.length > 0 && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                Arts. {enunciado.metadados.artigos.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => setExpandedEnunciado(isExpanded ? null : enunciado.numero)}
                          className="text-blue-600 hover:text-blue-800 p-2"
                        >
                          {isExpanded ? <X className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                          <div>
                            <h4 className="font-semibold text-sm text-gray-700 mb-1">Texto Completo:</h4>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                              {enunciado.texto}
                            </p>
                          </div>

                          {enunciado.classification && (
                            <div>
                              <h4 className="font-semibold text-sm text-gray-700 mb-1">Raciocínio da IA:</h4>
                              <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                                {enunciado.classification.raciocinio}
                              </p>
                            </div>
                          )}

                          {enunciado.metadados.numeroPropostaPublica && (
                            <div>
                              <h4 className="font-semibold text-sm text-gray-700">Proposta Pública:</h4>
                              <p className="text-sm text-gray-600">{enunciado.metadados.numeroPropostaPublica}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
