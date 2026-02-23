'use client';

import { useState } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, Loader2, ArrowRight, Info } from 'lucide-react';

export default function TCUConverterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedFile, setConvertedFile] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setConvertedFile(null);
      setError(null);
    }
  };

  const handleConvert = async () => {
    if (!file) {
      setError('Por favor, selecione um arquivo');
      return;
    }

    setIsConverting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/convert-tcu', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao converter arquivo');
      }

      // Pega o blob do arquivo convertido
      const blob = await response.blob();
      setConvertedFile(blob);

      alert('✅ Conversão concluída com sucesso!');
    } catch (err) {
      console.error('Erro ao converter:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!convertedFile) return;

    const url = URL.createObjectURL(convertedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TCU_Convertido_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-blue-600" />
            Conversor de Excel TCU
          </h1>
          <p className="text-gray-600 mt-2">
            Converta planilhas oficiais do TCU para o formato de importação do sistema
          </p>
        </div>

        {/* Info Box */}
        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-bold mb-1">Colunas esperadas do TCU:</p>
              <p className="text-blue-800">
                Enunciado, Acórdão, Área, Tema, Subtema, Data, Autor da tese, Legislação, Outros indexadores
              </p>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">1. Selecione o arquivo Excel do TCU</h2>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-3"
            >
              <Upload className="w-12 h-12 text-gray-400" />
              {file ? (
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-600">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                  <p className="text-xs text-blue-600 mt-2">Clique para escolher outro arquivo</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900">
                    Clique para selecionar arquivo
                  </p>
                  <p className="text-sm text-gray-600">
                    Arquivos .xlsx ou .xls do TCU
                  </p>
                </div>
              )}
            </label>
          </div>

          {/* Convert Button */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleConvert}
              disabled={!file || isConverting}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-lg font-medium shadow-lg"
            >
              {isConverting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Convertendo...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-5 h-5" />
                  Converter Arquivo
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-900">Erro ao converter</p>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success & Download */}
        {convertedFile && (
          <div className="bg-green-50 rounded-xl shadow-lg p-8 border-2 border-green-200">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <h2 className="text-xl font-bold text-green-900">Conversão concluída!</h2>
                <p className="text-green-700">Arquivo pronto para download</p>
              </div>
            </div>

            {/* Download Button */}
            <div className="flex flex-col gap-4">
              <button
                onClick={handleDownload}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-lg font-medium shadow-lg"
              >
                <Download className="w-5 h-5" />
                Baixar Excel Convertido
              </button>

              <a
                href="/admin/importar"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-lg font-medium shadow-lg"
              >
                <ArrowRight className="w-5 h-5" />
                Ir para Importação
              </a>
            </div>

            <div className="mt-6 p-4 bg-white rounded-lg border border-green-200">
              <p className="text-sm text-gray-700">
                <strong>📋 Próximos passos:</strong>
              </p>
              <ol className="mt-2 text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Baixe o arquivo convertido</li>
                <li>Revise os dados na aba &quot;Dados&quot; (opcional)</li>
                <li>Vá para /admin/importar</li>
                <li>Faça upload do arquivo convertido</li>
                <li>Valide e importe os documentos</li>
              </ol>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">📚 Como usar</h3>
          <ol className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">1.</span>
              <span>Baixe a planilha oficial do TCU com os acórdãos</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">2.</span>
              <span>Faça upload aqui nesta página</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">3.</span>
              <span>Clique em &quot;Converter Arquivo&quot;</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">4.</span>
              <span>Baixe o Excel convertido (formato do sistema)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">5.</span>
              <span>Importe em /admin/importar</span>
            </li>
          </ol>

          <div className="mt-4 p-3 bg-blue-100 rounded border border-blue-200">
            <p className="text-xs text-blue-900">
              <strong>💡 Dica:</strong> O conversor identifica automaticamente os cursos relevantes
              e gera tags baseadas nos metadados do TCU. Você pode revisar e ajustar os dados
              no Excel antes de importar.
            </p>
          </div>
        </div>
      </div>
  );
}
