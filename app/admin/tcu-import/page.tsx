'use client';

import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { CheckSquare, Square, Edit2, Save, Eye, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface AcordaoPreview {
  numeroAcordao: string;
  anoAcordao: string;
  titulo: string;
  sumario: string;
  colegiado: string;
  relator: string;
  tipo: string;
  relevanceScore: number;
  isRelevant: boolean;
  suggestedCourses: string[];
  isNovo?: boolean;
  urlAcordao?: string;
  urlArquivoPDF?: string;
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

  // Filtros avançados
  const [filterColegiado, setFilterColegiado] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Seleção e edição
  const [selectedAcordaos, setSelectedAcordaos] = useState<Set<string>>(new Set());
  const [editingCourses, setEditingCourses] = useState<Record<string, string[]>>({});
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [editingDescriptions, setEditingDescriptions] = useState<Record<string, string>>({});

  // Modal de preview
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedAcordao, setSelectedAcordao] = useState<AcordaoPreview | null>(null);

  // Edição em lote
  const [showBulkEditPanel, setShowBulkEditPanel] = useState(false);
  const [bulkEditCategory, setBulkEditCategory] = useState('acordao');

  const handleLoadPreview = async () => {
    setLoading(true);
    setPreview([]);
    setStats(null);
    setResult(null);
    setSelectedAcordaos(new Set());
    setEditingCourses({});

    try {
      const params = new URLSearchParams({
        quantidade: quantidade.toString(),
        anoInicio: anoInicio.toString(),
        onlyRelevant: onlyRelevant.toString(),
      });

      if (searchTerm && searchTerm.trim()) {
        params.append('searchTerm', searchTerm.trim());
      }

      const response = await fetch(`/api/admin/tcu-import?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar acórdãos');
      }

      setPreview(data.preview || []);
      setStats(data.stats);
      setNovosCount(data.novos || 0);
      setExistentesCount(data.existentes || 0);

      // Selecionar automaticamente todos os novos
      const novosKeys = (data.preview || [])
        .filter((ac: AcordaoPreview) => ac.isNovo)
        .map((ac: AcordaoPreview) => `${ac.numeroAcordao}/${ac.anoAcordao}`);
      setSelectedAcordaos(new Set(novosKeys));
    } catch (error) {
      alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const selectedCount = selectedAcordaos.size;
    if (selectedCount === 0) {
      alert('Selecione pelo menos um acórdão para importar');
      return;
    }

    if (!confirm(`Deseja importar ${selectedCount} acórdão${selectedCount !== 1 ? 's' : ''}?`)) {
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      // Aplicar edições de cursos, descrições e observações
      const selectedWithEdits = preview
        .filter(ac => selectedAcordaos.has(`${ac.numeroAcordao}/${ac.anoAcordao}`))
        .map(ac => {
          const key = `${ac.numeroAcordao}/${ac.anoAcordao}`;
          return {
            ...ac,
            suggestedCourses: editingCourses[key] || ac.suggestedCourses,
            customDescription: editingDescriptions[key] || undefined,
            notes: editingNotes[key] || undefined,
          };
        });

      const response = await fetch('/api/admin/tcu-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantidade,
          anoInicio,
          onlyRelevant,
          mode,
          selectedAcordaos: selectedWithEdits, // Enviar apenas os selecionados com edições
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

  const toggleSelection = (key: string) => {
    const newSet = new Set(selectedAcordaos);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedAcordaos(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedAcordaos.size === filteredPreview.length) {
      setSelectedAcordaos(new Set());
    } else {
      const allKeys = filteredPreview.map(ac => `${ac.numeroAcordao}/${ac.anoAcordao}`);
      setSelectedAcordaos(new Set(allKeys));
    }
  };

  const handleEditCourses = (key: string, courses: string[]) => {
    setEditingCourses({
      ...editingCourses,
      [key]: courses,
    });
  };

  const toggleCourseInEdit = (key: string, courseId: string) => {
    const current = editingCourses[key] || preview.find(ac => `${ac.numeroAcordao}/${ac.anoAcordao}` === key)?.suggestedCourses || [];
    const newCourses = current.includes(courseId)
      ? current.filter(c => c !== courseId)
      : [...current, courseId];
    handleEditCourses(key, newCourses);
  };

  // Abrir modal de preview com ementa completa
  const handleOpenPreview = (acordao: AcordaoPreview) => {
    setSelectedAcordao(acordao);
    setPreviewModalOpen(true);
  };

  // Aplicar edições em lote
  const handleApplyBulkEdits = () => {
    // Aqui aplicamos a categoria em lote para todos os selecionados
    // Por enquanto, isso só será aplicado na importação
    // A categoria será usada quando os acórdãos forem importados
    alert(`Categoria "${bulkEditCategory}" será aplicada aos ${selectedAcordaos.size} acórdãos selecionados na importação.`);
    setShowBulkEditPanel(false);
  };

  // Filtrar preview
  const filteredPreview = preview.filter(ac => {
    if (filterColegiado && ac.colegiado !== filterColegiado) return false;
    if (filterTipo && ac.tipo !== filterTipo) return false;
    return true;
  });

  // Extrair valores únicos para filtros
  const colegiadosUnicos = [...new Set(preview.map(ac => ac.colegiado))].filter(Boolean);
  const tiposUnicos = [...new Set(preview.map(ac => ac.tipo))].filter(Boolean);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto p-6">
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
                <span className="text-sm">Apenas acórdãos relevantes</span>
              </label>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">🔍 Buscar por palavra-chave</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite uma palavra-chave para buscar na ementa ou título..."
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              A busca será feita no título e ementa dos acórdãos
            </p>
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

        {/* Filtros Avançados e Preview */}
        {preview.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">👀 Preview ({filteredPreview.length})</h2>

              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
              >
                {selectedAcordaos.size === filteredPreview.length ? (
                  <>
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                    Desmarcar Todos
                  </>
                ) : (
                  <>
                    <Square className="w-5 h-5" />
                    Selecionar Todos
                  </>
                )}
              </button>
            </div>

            {/* Filtros Avançados */}
            <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded">
              <div>
                <label className="block text-sm font-medium mb-2">Filtrar por Colegiado</label>
                <select
                  value={filterColegiado}
                  onChange={(e) => setFilterColegiado(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">Todos</option>
                  {colegiadosUnicos.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Filtrar por Tipo</label>
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">Todos</option>
                  {tiposUnicos.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Painel de Edição em Lote */}
            {selectedAcordaos.size > 0 && (
              <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-purple-900">
                    ✏️ Edição em Lote ({selectedAcordaos.size} selecionados)
                  </h3>
                  <button
                    onClick={() => setShowBulkEditPanel(!showBulkEditPanel)}
                    className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    {showBulkEditPanel ? 'Ocultar' : 'Mostrar Opções'}
                  </button>
                </div>

                {showBulkEditPanel && (
                  <div className="space-y-4">
                    {/* Alterar Categoria em Lote */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-purple-900">
                        Categoria (será aplicada a todos os selecionados)
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={bulkEditCategory}
                          onChange={(e) => setBulkEditCategory(e.target.value)}
                          className="flex-1 px-3 py-2 border-2 border-purple-300 rounded focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="acordao">Acórdão</option>
                          <option value="parecer">Parecer</option>
                          <option value="orientacao-normativa">Orientação Normativa</option>
                          <option value="apostila">Apostila</option>
                          <option value="artigo">Artigo</option>
                          <option value="edital">Edital</option>
                          <option value="outro">Outro</option>
                        </select>
                        <button
                          onClick={handleApplyBulkEdits}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>

                    {/* Informação */}
                    <div className="text-xs text-purple-700 bg-purple-100 p-3 rounded">
                      💡 <strong>Dica:</strong> As alterações de categoria serão aplicadas durante a importação.
                      Para editar cursos individualmente, use os botões azuis em cada acórdão.
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              {filteredPreview.map((acordao, idx) => {
                const key = `${acordao.numeroAcordao}/${acordao.anoAcordao}`;
                const isSelected = selectedAcordaos.has(key);
                const currentCourses = editingCourses[key] || acordao.suggestedCourses;

                return (
                  <div
                    key={idx}
                    className={`border rounded-lg p-4 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : acordao.isNovo
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox de seleção */}
                      <button
                        onClick={() => toggleSelection(key)}
                        className="mt-1"
                        disabled={!acordao.isNovo}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-6 h-6 text-blue-600" />
                        ) : (
                          <Square className="w-6 h-6 text-gray-400" />
                        )}
                      </button>

                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">
                                Acórdão TCU nº {acordao.numeroAcordao}/{acordao.anoAcordao}
                              </h3>
                              <button
                                onClick={() => handleOpenPreview(acordao)}
                                className="p-1 hover:bg-blue-100 rounded transition-colors"
                                title="Ver ementa completa"
                              >
                                <Eye className="w-5 h-5 text-blue-600" />
                              </button>
                              {acordao.urlAcordao && (
                                <a
                                  href={acordao.urlAcordao}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 hover:bg-green-100 rounded transition-colors"
                                  title="Abrir no site do TCU"
                                >
                                  <ExternalLink className="w-5 h-5 text-green-600" />
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {acordao.isNovo && (
                                <span className="text-sm bg-green-500 text-white px-2 py-1 rounded">
                                  ✨ NOVO
                                </span>
                              )}
                              {!acordao.isNovo && (
                                <span className="text-sm bg-gray-500 text-white px-2 py-1 rounded">
                                  ✓ JÁ IMPORTADO
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {acordao.colegiado} | {acordao.relator} | {acordao.tipo}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-semibold text-blue-600">
                              Score: {acordao.relevanceScore}%
                            </div>
                          </div>
                        </div>

                        <p className="text-sm text-gray-700 mb-3 line-clamp-2">{acordao.sumario}</p>

                        {/* Edição de Cursos */}
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Edit2 className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium">Cursos:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(courseNames).map(([id, name]) => {
                              const isActive = currentCourses.includes(id);
                              return (
                                <button
                                  key={id}
                                  onClick={() => toggleCourseInEdit(key, id)}
                                  disabled={!acordao.isNovo}
                                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                                    isActive
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  {isActive ? '✓ ' : ''}{name}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Campos de Edição - Descrição e Observações */}
                        {acordao.isNovo && (
                          <div className="space-y-3 border-t border-gray-200 pt-4 mt-4">
                            {/* Campo de Descrição Customizada */}
                            <div>
                              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-1">
                                <Edit2 className="w-3 h-3" />
                                Descrição Customizada (opcional)
                              </label>
                              <textarea
                                value={editingDescriptions[key] || ''}
                                onChange={(e) => setEditingDescriptions({
                                  ...editingDescriptions,
                                  [key]: e.target.value
                                })}
                                placeholder="Deixe em branco para usar o sumário original ou edite para customizar..."
                                rows={2}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Se deixar em branco, será usado: &quot;{acordao.sumario.substring(0, 80)}...&quot;
                              </p>
                            </div>

                            {/* Campo de Observações/Comentários */}
                            <div>
                              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-1">
                                <Edit2 className="w-3 h-3" />
                                Observações/Comentários
                              </label>
                              <textarea
                                value={editingNotes[key] || ''}
                                onChange={(e) => setEditingNotes({
                                  ...editingNotes,
                                  [key]: e.target.value
                                })}
                                placeholder="Adicione observações, contexto, trechos importantes, análise..."
                                rows={3}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                💡 Adicione comentários que ajudem os alunos a entender a relevância deste acórdão
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Importação */}
        {selectedAcordaos.size > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">3. Importar Selecionados</h2>

            <div className="mb-4 p-4 bg-blue-50 rounded">
              <p className="text-sm font-medium">
                {selectedAcordaos.size} acórdão{selectedAcordaos.size !== 1 ? 's' : ''} selecionado{selectedAcordaos.size !== 1 ? 's' : ''} para importação
              </p>
            </div>

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
                  <span>Completo (todos selecionados)</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Importando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Importar {selectedAcordaos.size} Acórdão{selectedAcordaos.size !== 1 ? 's' : ''}
                </>
              )}
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

      {/* Modal de Preview da Ementa */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedAcordao && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">
                  Acórdão TCU nº {selectedAcordao.numeroAcordao}/{selectedAcordao.anoAcordao}
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600 mt-2">
                  {selectedAcordao.colegiado} | Relator: {selectedAcordao.relator}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Título */}
                {selectedAcordao.titulo && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-1">Título:</h4>
                    <p className="text-sm text-gray-900">{selectedAcordao.titulo}</p>
                  </div>
                )}

                {/* Ementa Completa */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-1">Ementa:</h4>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedAcordao.sumario}</p>
                  </div>
                </div>

                {/* Metadados */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                  <div>
                    <span className="text-xs font-semibold text-gray-600">Tipo:</span>
                    <p className="text-sm text-gray-900">{selectedAcordao.tipo}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-600">Score de Relevância:</span>
                    <p className="text-sm text-gray-900">{selectedAcordao.relevanceScore}%</p>
                  </div>
                </div>

                {/* Cursos Sugeridos */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">Cursos Sugeridos:</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAcordao.suggestedCourses.map(courseId => (
                      <span
                        key={courseId}
                        className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full"
                      >
                        {courseNames[courseId] || `Curso ${courseId}`}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Links */}
                <div className="flex gap-4 pt-4 border-t">
                  {selectedAcordao.urlAcordao && (
                    <a
                      href={selectedAcordao.urlAcordao}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir no site do TCU
                    </a>
                  )}
                  {selectedAcordao.urlArquivoPDF && (
                    <a
                      href={selectedAcordao.urlArquivoPDF}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Download PDF
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
