'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload, Loader2, CheckCircle, AlertCircle, FileText, ExternalLink } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { useToast } from '@/hooks/use-toast';

interface OrientacaoPreview {
  numero: string;
  titulo: string;
  descricao: string;
  tags: string[];
  linkFundamentacao?: string;
  fundamentacaoLinks: string[]; // Array de todos os links de fundamentação
  versaoHistorica?: string;     // Indica se é uma versão histórica
}

export default function AGUImportPage() {
  const router = useRouter();
  const { success, error: errorToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<OrientacaoPreview[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [importResult, setImportResult] = useState<any>(null);

  const handlePreview = async () => {
    setIsLoading(true);
    setPreview([]);
    setImportResult(null);

    try {
      const response = await fetch('/api/admin/agu-import');

      if (!response.ok) {
        throw new Error('Erro ao buscar orientações');
      }

      const data = await response.json();

      setPreview(data.orientacoes || []);
      setTotalFound(data.total || 0);

      success(
        'Preview carregado!',
        `${data.total} Orientações Normativas encontradas no site da AGU`
      );
    } catch (error) {
      console.error('Erro ao buscar preview:', error);
      errorToast(
        'Erro ao carregar preview',
        error instanceof Error ? error.message : 'Erro desconhecido'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!confirm(`Confirma a importação de ${totalFound} Orientações Normativas para TODOS OS CURSOS?`)) {
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const response = await fetch('/api/admin/agu-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addToAllCourses: true,
          makePublic: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao importar orientações');
      }

      const data = await response.json();

      setImportResult(data);

      success(
        'Importação concluída!',
        `${data.stats.documentosCriados} documentos criados em ${data.stats.cursosAlvo} cursos`
      );
    } catch (error) {
      console.error('Erro na importação:', error);
      errorToast(
        'Erro na importação',
        error instanceof Error ? error.message : 'Erro desconhecido'
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Importação Automática - Orientações Normativas da AGU
                </h2>
                <p className="text-gray-600">
                  Importe automaticamente as Orientações Normativas do site da AGU para todos os cursos
                </p>
              </div>
              <a
                href="https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium text-gray-700"
              >
                <ExternalLink className="w-4 h-4" />
                Ver site da AGU
              </a>
            </div>
          </div>

          {/* Ações */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Carregar Preview */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">1. Carregar Preview</h3>
                  <p className="text-sm text-gray-600">Visualize as orientações antes de importar</p>
                </div>
              </div>

              <button
                onClick={handlePreview}
                disabled={isLoading || isImporting}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Carregar Preview
                  </>
                )}
              </button>
            </div>

            {/* Importar */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">2. Importar para o Sistema</h3>
                  <p className="text-sm text-gray-600">Adiciona a todos os 10 cursos</p>
                </div>
              </div>

              <button
                onClick={handleImport}
                disabled={isImporting || preview.length === 0 || isLoading}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Importar {totalFound > 0 ? `(${totalFound})` : ''}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Resultado da Importação */}
          {importResult && (
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <h3 className="text-xl font-bold text-green-900">Importação Concluída!</h3>
                  <p className="text-green-700">{importResult.message}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {importResult.stats.orientacoesEncontradas}
                  </div>
                  <div className="text-sm text-gray-600">Orientações encontradas</div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {importResult.stats.cursosAlvo}
                  </div>
                  <div className="text-sm text-gray-600">Cursos</div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {importResult.stats.documentosCriados}
                  </div>
                  <div className="text-sm text-gray-600">Documentos criados</div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-600">
                    {importResult.stats.erros}
                  </div>
                  <div className="text-sm text-gray-600">Erros</div>
                </div>
              </div>
            </div>
          )}

          {/* Preview das Orientações */}
          {preview.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Preview das Orientações</h3>
                    <p className="text-sm text-gray-600">
                      Mostrando 10 de {totalFound} orientações encontradas
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {preview.map((on, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl border-2 border-gray-200 hover:border-purple-300 transition-all bg-gradient-to-r from-purple-50 to-pink-50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900">{on.numero}</h4>
                          {on.versaoHistorica && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs font-bold rounded-full">
                              {on.versaoHistorica}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{on.titulo}</p>
                      </div>
                      {on.fundamentacaoLinks && on.fundamentacaoLinks.length > 0 && (
                        <div className="flex items-center gap-1 ml-2">
                          <span className="text-xs text-gray-500 font-medium">
                            {on.fundamentacaoLinks.length} PDF{on.fundamentacaoLinks.length > 1 ? 's' : ''}
                          </span>
                          <a
                            href={on.fundamentacaoLinks[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title={`Ver ${on.fundamentacaoLinks.length > 1 ? 'primeiro PDF' : 'PDF'} de fundamentação`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      )}
                    </div>

                    {on.descricao && (
                      <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                        {on.descricao}
                      </p>
                    )}

                    {on.fundamentacaoLinks && on.fundamentacaoLinks.length > 1 && (
                      <div className="mt-2 p-2 bg-white rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Links de Fundamentação:</p>
                        <div className="flex flex-wrap gap-1">
                          {on.fundamentacaoLinks.map((link, i) => (
                            <a
                              key={i}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded hover:bg-blue-100 transition-colors"
                              title={`Fundamentação ${i + 1}`}
                            >
                              [{i + 1}]
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {on.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {on.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {totalFound > 10 && (
                <div className="mt-6 text-center text-sm text-gray-600">
                  ... e mais {totalFound - 10} orientações
                </div>
              )}
            </div>
          )}

          {/* Informações */}
          {preview.length === 0 && !importResult && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-blue-900 mb-2">Como funciona?</h4>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start gap-2">
                      <span className="font-bold">1.</span>
                      <span>
                        <strong>Carregar Preview:</strong> Acessa o site da AGU e extrai todas as Orientações Normativas disponíveis
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">2.</span>
                      <span>
                        <strong>Revisar:</strong> Visualize as orientações que serão importadas (título, descrição, tags)
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">3.</span>
                      <span>
                        <strong>Importar:</strong> Adiciona cada orientação a TODOS OS 10 CURSOS como documentos públicos
                      </span>
                    </li>
                  </ul>
                  <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                    <p className="text-xs text-blue-900">
                      <strong>Nota:</strong> As orientações são importadas como <strong>links externos</strong> para o site da AGU.
                      Cada orientação será marcada com a categoria <strong>"Orientação Normativa"</strong> e estará disponível
                      para todos os alunos em todos os cursos.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
