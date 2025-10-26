'use client';

import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';

interface AcordaoPreview {
  numeroAcordao: string;
  anoAcordao: string;
  titulo: string;
  sumario: string;
  colegiado: string;
  relator: string;
  relevanceScore: number;
  isRelevant: boolean;
  suggestedCourses: string[];
  isNovo?: boolean;
}

interface ImportStats {
  total: number;
  relevant: number;
  irrelevant: number;
  byCourse: Record<string, number>;
  byYear: Record<string, number>;
  avgScore: number;
}

interface ImportResult {
  stats: {
    documentosCriados: number;
    documentosPulados: number;
    erros: number;
  };
}

const courseNames: Record<string, string> = {
  '1': 'Nova Lei de Licitações',
  '2': 'Planejamento das Contratações',
  '3': 'Gestão e Fiscalização',
  '4': 'Processo Sancionador',
  '5': 'Inovação nas Contratações',
  '6': 'Terceirização e Formação de Preços',
  '7': 'Assessoramento Jurídico',
  '8': 'Revisão, Reajuste e Repactuação',
  '9': 'Alterações Contratuais',
  '10': 'Contratação Direta',
};

export default function TCUImportPage() {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<AcordaoPreview[]>([]);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [novosCount, setNovosCount] = useState(0);
  const [existentesCount, setExistentesCount] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Configurações
  const [quantidade, setQuantidade] = useState(100);
  const [anoInicio, setAnoInicio] = useState<number>(new Date().getFullYear());
  const [onlyRelevant, setOnlyRelevant] = useState(true);
  const [mode, setMode] = useState<'incremental' | 'completo'>('incremental');

  const handleLoadPreview = async () => {
    setLoading(true);
    setPreview([]);
    setStats(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        quantidade: quantidade.toString(),
        anoInicio: anoInicio.toString(),
        onlyRelevant: onlyRelevant.toString(),
      });

      const response = await fetch(`/api/admin/tcu-import?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar acórdãos');
      }

      setPreview(data.preview || []);
      setStats(data.stats);
      setNovosCount(data.novos || 0);
      setExistentesCount(data.existentes || 0);
    } catch (error) {
      alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!confirm(`Deseja importar ${novosCount} novos acórdãos?`)) {
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/tcu-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantidade,
          anoInicio,
          onlyRelevant,
          mode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao importar');
      }

      setResult(data);
      alert(`✅ Importação concluída!\n\n${data.stats.documentosCriados} documentos criados`);

      // Recarrega preview
      handleLoadPreview();
    } catch (error) {
      alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🏛️ Importação de Acórdãos do TCU</h1>

        {/* Configurações */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">1. Configurações</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Quantidade</label>
              <input
                type="number"
                value={quantidade}
                onChange={(e) => setQuantidade(parseInt(e.target.value) || 100)}
                min={10}
                max={500}
                className="w-full px-3 py-2 border rounded"
              />
              <p className="text-xs text-gray-500 mt-1">Máximo: 500</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Ano Inicial</label>
              <input
                type="number"
                value={anoInicio}
                onChange={(e) => setAnoInicio(parseInt(e.target.value) || new Date().getFullYear())}
                min={2000}
                max={new Date().getFullYear()}
                className="w-full px-3 py-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Filtros</label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={onlyRelevant}
                  onChange={(e) => setOnlyRelevant(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">Apenas acórdãos relevantes (licitações/contratos)</span>
              </label>
            </div>
          </div>

          <button
            onClick={handleLoadPreview}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Carregando...' : '📋 Carregar Preview'}
          </button>
        </div>

        {/* Estatísticas */}
        {stats && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">📊 Estatísticas</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-gray-600">Analisados</div>
              </div>

              <div className="bg-green-50 p-4 rounded">
                <div className="text-2xl font-bold text-green-600">{stats.relevant}</div>
                <div className="text-sm text-gray-600">Relevantes</div>
              </div>

              <div className="bg-yellow-50 p-4 rounded">
                <div className="text-2xl font-bold text-yellow-600">{novosCount}</div>
                <div className="text-sm text-gray-600">Novos</div>
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <div className="text-2xl font-bold text-gray-600">{existentesCount}</div>
                <div className="text-sm text-gray-600">Já Importados</div>
              </div>
            </div>

            {/* Distribuição por curso */}
            {Object.keys(stats.byCourse).length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Distribuição por Curso:</h3>
                <div className="space-y-2">
                  {Object.entries(stats.byCourse)
                    .sort(([, a], [, b]) => b - a)
                    .map(([courseId, count]) => (
                      <div key={courseId} className="flex items-center justify-between text-sm">
                        <span>{courseNames[courseId] || `Curso ${courseId}`}</span>
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">👀 Preview (primeiros 10)</h2>

            <div className="space-y-4">
              {preview.map((acordao, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-4 ${
                    acordao.isNovo ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">
                        Acórdão TCU nº {acordao.numeroAcordao}/{acordao.anoAcordao}
                        {acordao.isNovo && (
                          <span className="ml-2 text-sm bg-green-500 text-white px-2 py-1 rounded">
                            ✨ NOVO
                          </span>
                        )}
                        {!acordao.isNovo && (
                          <span className="ml-2 text-sm bg-gray-500 text-white px-2 py-1 rounded">
                            ✓ JÁ IMPORTADO
                          </span>
                        )}
                      </h3>
                      <div className="text-sm text-gray-600">
                        {acordao.colegiado} | {acordao.relator}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold text-blue-600">
                        Score: {acordao.relevanceScore}%
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 mb-2 line-clamp-2">{acordao.sumario}</p>

                  <div className="flex flex-wrap gap-2">
                    {acordao.suggestedCourses.map((courseId) => (
                      <span
                        key={courseId}
                        className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                      >
                        📚 {courseNames[courseId] || `Curso ${courseId}`}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Importação */}
        {novosCount > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">3. Importar</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Modo de Importação</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="incremental"
                    checked={mode === 'incremental'}
                    onChange={(e) => setMode(e.target.value as 'incremental')}
                    className="mr-2"
                  />
                  <span>Incremental (apenas novos - recomendado)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="completo"
                    checked={mode === 'completo'}
                    onChange={(e) => setMode(e.target.value as 'completo')}
                    className="mr-2"
                  />
                  <span>Completo (todos do período)</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleImport}
              disabled={importing || novosCount === 0}
              className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {importing
                ? 'Importando...'
                : `✅ Importar ${novosCount} acórdão${novosCount !== 1 ? 'ãos' : 'ão'} novo${novosCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-green-800 mb-4">✅ Importação Concluída</h2>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold text-green-600">{result.stats.documentosCriados}</div>
                <div className="text-sm text-gray-600">Documentos Criados</div>
              </div>

              <div>
                <div className="text-2xl font-bold text-gray-600">{result.stats.documentosPulados}</div>
                <div className="text-sm text-gray-600">Pulados (duplicatas)</div>
              </div>

              <div>
                <div className="text-2xl font-bold text-red-600">{result.stats.erros}</div>
                <div className="text-sm text-gray-600">Erros</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
