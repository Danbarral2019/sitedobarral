'use client';

import { useState, useEffect } from 'react';


type AGUDocumentType =
  | 'orientacao-normativa'
  | 'sumula'
  | 'parecer-vinculante'
  | 'parecer-conuni'
  | 'modelo'
  | 'guia'
  | 'nota-tecnica';

interface DocumentTypeInfo {
  id: AGUDocumentType;
  name: string;
  url: string;
  status: 'funcionando' | 'playwright' | 'planejado';
  description: string;
  needsPlaywright: boolean;
}

const DOCUMENT_TYPES: DocumentTypeInfo[] = [
  {
    id: 'orientacao-normativa',
    name: 'Orientações Normativas (ONs)',
    url: 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu',
    status: 'funcionando',
    description: '~97 documentos (28 relevantes 2020+)',
    needsPlaywright: false,
  },
  {
    id: 'sumula',
    name: 'Súmulas AGU',
    url: 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/sumula',
    status: 'funcionando',
    description: '~78 súmulas (4 relevantes 2020+)',
    needsPlaywright: false,
  },
  {
    id: 'parecer-vinculante',
    name: 'Pareceres Vinculantes',
    url: 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/pareceresvinculantes',
    status: 'playwright',
    description: '⚙️ Execução Manual via Claude Code - Requer MCP Playwright (site com JavaScript dinâmico). Instruções: Abra o chat do Claude Code e digite: "Extrair pareceres vinculantes AGU usando Playwright MCP"',
    needsPlaywright: true,
  },
  {
    id: 'parecer-conuni',
    name: 'Pareceres DECOR/CONUNI',
    url: 'https://cgu.agu.gov.br/decor/',
    status: 'playwright',
    description: '⚙️ Execução Manual via Claude Code - Requer MCP Playwright (site com JavaScript dinâmico). Instruções: Abra o chat do Claude Code e digite: "Extrair pareceres DECOR usando Playwright MCP"',
    needsPlaywright: true,
  },
];

interface AGUStats {
  counts: Array<{ category: string; label: string; count: number }>;
  totalDocuments: number;
  lastImport: {
    date: string;
    category: string;
    title: string;
  } | null;
}

export default function ScraperAGUPage() {
  const [aguStats, setAguStats] = useState<AGUStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<AGUDocumentType[]>(['orientacao-normativa']);
  const [anoInicio, setAnoInicio] = useState(2020);
  const [filtroRelevancia, setFiltroRelevancia] = useState(true);
  const [mode, setMode] = useState<'incremental' | 'completo' | 'atualizar'>('incremental');
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    fetch('/api/admin/agu-stats')
      .then(res => res.ok ? res.json() : null)
      .then(data => setAguStats(data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);
  const [previewData, setPreviewData] = useState<{
    total: number;
    novas: number;
    existentes: number;
    documentos: Array<{
      titulo: string;
      descricao: string;
      tags: string[];
      relevanciaScore: number;
      cursosIds: string[];
      isNova: boolean;
    }>;
    stats: {
      taxaRelevancia: number;
      porTipo?: Record<string, number>;
    };
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    mode: string;
    stats: {
      documentosCriados: number;
      documentosAtualizados: number;
      documentosPulados: number;
      erros: number;
      tempoExecucao: string;
      relevanciaMedia: string;
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleType = (typeId: AGUDocumentType) => {
    setSelectedTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
    );
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    setError(null);
    setPreviewData(null);
    setImportResult(null);

    try {
      const params = new URLSearchParams({
        tipos: selectedTypes.join(','),
        anoInicio: anoInicio.toString(),
        filtroRelevancia: filtroRelevancia.toString(),
      });

      const response = await fetch(`/api/admin/scrape-agu?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar documentos');
      }

      setPreviewData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!window.confirm(`Confirma importação no modo "${mode}"?\n\n${previewData?.novas} novos documentos serão importados.`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setImportResult(null);

    try {
      const response = await fetch('/api/admin/scrape-agu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipos: selectedTypes,
          anoInicio,
          filtroRelevancia,
          addToAllCourses: true,
          makePublic: true,
          mode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao importar documentos');
      }

      setImportResult(data);
      setPreviewData(null); // Limpa preview após importação
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedNeedsPlaywright = DOCUMENT_TYPES
    .filter(t => selectedTypes.includes(t.id))
    .some(t => t.needsPlaywright);

  return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">AGU Scraper v4</h1>
          <p className="text-gray-600">
            Sistema unificado de scraping para documentos da AGU relacionados a licitações e contratos
          </p>
        </div>

        {/* Estatisticas do Acervo AGU */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Acervo AGU no Banco de Dados</h2>
          {statsLoading ? (
            <p className="text-sm text-gray-500">Carregando estatisticas...</p>
          ) : aguStats ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                {aguStats.counts.map(item => (
                  <div key={item.category} className="bg-gray-50 p-3 rounded text-center">
                    <div className="text-2xl font-bold text-blue-600">{item.count}</div>
                    <div className="text-xs text-gray-600">{item.label}</div>
                  </div>
                ))}
                <div className="bg-blue-50 p-3 rounded text-center">
                  <div className="text-2xl font-bold text-blue-800">{aguStats.totalDocuments}</div>
                  <div className="text-xs text-gray-600">Total AGU</div>
                </div>
              </div>
              {aguStats.lastImport && (
                <p className="text-xs text-gray-500">
                  Ultima importacao: {new Date(aguStats.lastImport.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {' '}&mdash; {aguStats.lastImport.title}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">Nao foi possivel carregar estatisticas.</p>
          )}
        </div>

        {/* Seleção de Tipos */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">1. Selecione os Tipos de Documentos</h2>

          <div className="space-y-3">
            {DOCUMENT_TYPES.map(type => (
              <div key={type.id} className="flex items-start">
                <input
                  type="checkbox"
                  id={type.id}
                  checked={selectedTypes.includes(type.id)}
                  onChange={() => toggleType(type.id)}
                  disabled={type.status === 'planejado'}
                  className="mt-1 mr-3"
                />
                <label htmlFor={type.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{type.name}</span>
                    {type.status === 'funcionando' && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                        ✅ Funcionando
                      </span>
                    )}
                    {type.status === 'playwright' && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                        🎭 Playwright MCP
                      </span>
                    )}
                    {type.status === 'planejado' && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        📅 Planejado
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{type.description}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    <a href={type.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {type.url}
                    </a>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Configurações */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">2. Configurações de Scraping</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Ano Inicial
              </label>
              <input
                type="number"
                value={anoInicio}
                onChange={(e) => setAnoInicio(parseInt(e.target.value))}
                min={1997}
                max={new Date().getFullYear()}
                className="w-full px-3 py-2 border rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                Documentos a partir deste ano
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Modo de Importação
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'incremental' | 'completo' | 'atualizar')}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="incremental">Incremental (apenas novos)</option>
                <option value="completo">Completo (reimporta tudo)</option>
                <option value="atualizar">Atualizar (dados existentes)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {mode === 'incremental' && 'Importa apenas documentos novos'}
                {mode === 'completo' && 'Reimporta todos (ignora duplicatas)'}
                {mode === 'atualizar' && 'Atualiza dados de documentos existentes'}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filtroRelevancia}
                onChange={(e) => setFiltroRelevancia(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium">
                Filtrar apenas documentos relevantes para licitações/contratos
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Score de relevância ≥ 10 (baseado em palavras-chave)
            </p>
          </div>
        </div>

        {/* Alerta Playwright - Execução Manual */}
        {selectedNeedsPlaywright && (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-5 mb-6">
            <div className="flex items-start">
              <span className="text-3xl mr-4">⚙️</span>
              <div className="flex-1">
                <h3 className="font-bold text-blue-900 mb-2 text-lg">
                  ⚙️ Execução Manual via Claude Code
                </h3>
                <p className="text-sm text-blue-800 mb-3">
                  Você selecionou <strong>Pareceres Vinculantes e/ou DECOR</strong> que requerem execução manual via <strong>Playwright MCP</strong> (sites com JavaScript dinâmico).
                </p>

                <div className="bg-white border border-blue-200 rounded-lg p-4 mb-3">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <span>📋</span> Como executar:
                  </h4>
                  <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                    <li>Abra o <strong>chat do Claude Code</strong> (terminal CLI)</li>
                    <li>Digite um dos comandos abaixo:</li>
                  </ol>

                  <div className="mt-3 space-y-2">
                    <div className="bg-gray-100 p-3 rounded text-xs font-mono text-gray-900 border border-gray-300">
                      <div className="text-gray-600 mb-1">Para Pareceres Vinculantes:</div>
                      &quot;Extrair pareceres vinculantes AGU usando Playwright MCP&quot;
                    </div>
                    <div className="bg-gray-100 p-3 rounded text-xs font-mono text-gray-900 border border-gray-300">
                      <div className="text-gray-600 mb-1">Para Pareceres DECOR:</div>
                      &quot;Extrair pareceres DECOR usando Playwright MCP&quot;
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800">
                    <strong>⚠️ Nota:</strong> O botão &quot;Buscar Documentos&quot; abaixo <strong>NÃO funcionará</strong> para esses tipos (tentará HTTP fallback sem sucesso). Use o Claude Code conforme instruções acima.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">3. Executar Scraping</h2>

          <div className="flex gap-4">
            <button
              onClick={handlePreview}
              disabled={isPreviewing || selectedTypes.length === 0}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isPreviewing ? 'Buscando...' : '🔍 Buscar Documentos (Preview)'}
            </button>

            {previewData && (
              <button
                onClick={handleImport}
                disabled={isLoading || previewData.novas === 0}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Importando...' : `✅ Importar ${previewData.novas} Documentos`}
              </button>
            )}
          </div>

          <p className="text-sm text-gray-600 mt-4">
            Primeiro faça o preview para ver quais documentos serão importados,
            depois clique em Importar para adicionar ao banco de dados.
          </p>
        </div>

        {/* Erro */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-red-800 mb-2">❌ Erro</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Preview */}
        {previewData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">📊 Preview dos Resultados</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-2xl font-bold text-blue-600">{previewData.total}</div>
                <div className="text-sm text-gray-600">Total Encontrados</div>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <div className="text-2xl font-bold text-green-600">{previewData.novas}</div>
                <div className="text-sm text-gray-600">Novos</div>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-2xl font-bold text-gray-600">{previewData.existentes}</div>
                <div className="text-sm text-gray-600">Já Existentes</div>
              </div>
              <div className="bg-purple-50 p-4 rounded">
                <div className="text-2xl font-bold text-purple-600">
                  {previewData.stats.taxaRelevancia.toFixed(0)}%
                </div>
                <div className="text-sm text-gray-600">Taxa Relevância</div>
              </div>
            </div>

            {/* Distribuição por Tipo */}
            {previewData.stats.porTipo && Object.keys(previewData.stats.porTipo).length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Distribuição por Tipo:</h3>
                <div className="space-y-2">
                  {Object.entries(previewData.stats.porTipo).map(([tipo, count]) => (
                    <div key={tipo} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span className="text-sm">{tipo}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Primeiros Documentos */}
            {previewData.documentos && previewData.documentos.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">
                  Primeiros {Math.min(5, previewData.documentos.length)} Documentos:
                </h3>
                <div className="space-y-3">
                  {previewData.documentos.slice(0, 5).map((doc, idx: number) => (
                    <div key={idx} className="border rounded p-3 bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm">{doc.titulo}</h4>
                        {doc.isNova && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded ml-2">
                            NOVO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mb-2">
                        {doc.descricao.substring(0, 150)}...
                      </p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {doc.tags.slice(0, 5).map((tag: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500">
                        Score: {doc.relevanciaScore}/100 | Cursos: {doc.cursosIds.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resultado da Importação */}
        {importResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-green-800 mb-4">
              ✅ Importação Concluída com Sucesso!
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white p-3 rounded">
                <div className="text-xl font-bold text-green-600">
                  {importResult.stats.documentosCriados}
                </div>
                <div className="text-sm text-gray-600">Criados</div>
              </div>
              <div className="bg-white p-3 rounded">
                <div className="text-xl font-bold text-blue-600">
                  {importResult.stats.documentosAtualizados}
                </div>
                <div className="text-sm text-gray-600">Atualizados</div>
              </div>
              <div className="bg-white p-3 rounded">
                <div className="text-xl font-bold text-gray-600">
                  {importResult.stats.documentosPulados}
                </div>
                <div className="text-sm text-gray-600">Pulados</div>
              </div>
              <div className="bg-white p-3 rounded">
                <div className="text-xl font-bold text-red-600">
                  {importResult.stats.erros}
                </div>
                <div className="text-sm text-gray-600">Erros</div>
              </div>
            </div>

            <div className="text-sm text-gray-700">
              <p>Modo: <strong>{importResult.mode}</strong></p>
              <p>Tempo de execução: <strong>{importResult.stats.tempoExecucao}</strong></p>
              <p>Relevância média: <strong>{importResult.stats.relevanciaMedia}/100</strong></p>
            </div>
          </div>
        )}
      </div>
  );
}
