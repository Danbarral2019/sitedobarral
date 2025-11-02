'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import {
  Upload, Download, FileText, CheckCircle, XCircle,
  AlertCircle, ArrowLeft, Scale
} from 'lucide-react';

export default function ImportarLegislacaoPage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
    errorDetails?: Array<{ row: number; error: string; data?: Record<string, unknown> }>;
  } | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;

      // Parse CSV
      const rows = text.split('\n').map(row => {
        // Simple CSV parser (handles quoted values)
        const regex = /(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|([^\",]+)|,)/g;
        const cells: string[] = [];
        let match;

        while ((match = regex.exec(row)) !== null) {
          if (match[1] !== undefined) {
            // Quoted value
            cells.push(match[1].replace(/""/g, '"'));
          } else if (match[2] !== undefined) {
            // Unquoted value
            cells.push(match[2]);
          } else if (match[0] === ',') {
            // Empty cell
            if (cells.length === 0 || match.index === 0) {
              cells.push('');
            }
          }
        }

        return cells;
      }).filter(row => row.length > 0 && row.some(cell => cell.trim()));

      setCsvData(rows);
      setResults(null);
    };

    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (csvData.length === 0) {
      alert('Por favor, selecione um arquivo CSV primeiro');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/admin/legislative-acts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData })
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data.results);
      } else {
        alert(`Erro ao importar: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao importar:', error);
      alert('Erro ao importar atos normativos');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    window.open('/api/admin/legislative-acts/import/template', '_blank');
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin/legislacao')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para Legislação
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center">
              <Upload className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Importar Atos Normativos</h1>
              <p className="text-gray-600">Importação em massa via planilha CSV</p>
            </div>
          </div>
        </div>

        {/* Instruções */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Como Importar
          </h3>
          <ol className="space-y-2 text-blue-900">
            <li className="flex gap-2">
              <span className="font-bold">1.</span>
              <span>Baixe o template CSV clicando no botão abaixo</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">2.</span>
              <span>Preencha a planilha com os dados dos atos normativos</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">3.</span>
              <span>Salve como CSV (UTF-8)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">4.</span>
              <span>Faça upload do arquivo usando o botão abaixo</span>
            </li>
          </ol>

          <button
            onClick={downloadTemplate}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-5 h-5" />
            Baixar Template CSV
          </button>
        </div>

        {/* Upload de Arquivo */}
        {!results && (
          <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-10 h-10 text-green-600" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Selecione o Arquivo CSV
              </h3>
              <p className="text-gray-600 mb-6">
                Arquivo deve estar no formato CSV com as colunas do template
              </p>

              <label className="inline-block cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold">
                  Escolher Arquivo
                </div>
              </label>

              {fileName && (
                <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                  <p className="text-green-900 font-semibold">
                    Arquivo selecionado: {fileName}
                  </p>
                  <p className="text-green-700 text-sm">
                    {csvData.length - 1} linhas detectadas (excluindo cabeçalho)
                  </p>
                </div>
              )}
            </div>

            {csvData.length > 0 && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6" />
                      Importar {csvData.length - 1} Atos
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Resultados da Importação */}
        {results && (
          <div className="space-y-6">
            {/* Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-700 mb-1">Total Processado</div>
                <div className="text-3xl font-bold text-blue-900">{results.total}</div>
              </div>

              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <div className="text-sm font-medium text-green-700 mb-1 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Importados
                </div>
                <div className="text-3xl font-bold text-green-900">{results.imported}</div>
              </div>

              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                <div className="text-sm font-medium text-yellow-700 mb-1">Ignorados</div>
                <div className="text-3xl font-bold text-yellow-900">{results.skipped}</div>
                <div className="text-xs text-yellow-600">Duplicatas</div>
              </div>

              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <div className="text-sm font-medium text-red-700 mb-1 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  Erros
                </div>
                <div className="text-3xl font-bold text-red-900">{results.errors}</div>
              </div>
            </div>

            {/* Mensagem de Sucesso */}
            {results.imported > 0 && (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <h3 className="text-xl font-bold text-green-900">
                    Importação Concluída com Sucesso!
                  </h3>
                </div>
                <p className="text-green-800">
                  {results.imported} ato(s) normativo(s) foram importados para o banco de dados.
                </p>
              </div>
            )}

            {/* Lista de Erros */}
            {results.errorDetails && results.errorDetails.length > 0 && (
              <div className="bg-white rounded-xl border-2 border-red-300 p-6">
                <h3 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Erros Encontrados ({results.errorDetails.length})
                </h3>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {results.errorDetails?.map((err, idx: number) => (
                    <div key={idx} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-red-900">Linha {err.row}</p>
                          <p className="text-sm text-red-800 mt-1">{err.error}</p>
                          {err.data && (
                            <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-x-auto">
                              {JSON.stringify(err.data, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex gap-4 justify-center pt-6">
              <button
                onClick={() => {
                  setResults(null);
                  setCsvData([]);
                  setFileName('');
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
              >
                Nova Importação
              </button>

              <button
                onClick={() => router.push('/admin/legislacao')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2"
              >
                <Scale className="w-5 h-5" />
                Ver Todos os Atos
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
