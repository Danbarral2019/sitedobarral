'use client';

import { useState } from 'react';
import { Sparkles, X, Loader2, CheckCircle, AlertCircle, Brain, Zap, TrendingUp } from 'lucide-react';
import { courses } from '@/data/courses';

interface Classification {
  documentId: string;
  title: string;
  current: {
    courseId: string | null;
    category: string;
    tags: string[];
  };
  suggested: {
    courseIds: string[];
    courseSlugs: string[];
    category: string;
    tags: string[];
    confidence: number;
    source: 'basic' | 'claude' | 'hybrid';
    reasoning?: string;
    suggestedArticles?: number[];
  };
  applied: boolean;
}

interface BatchClassifyPanelProps {
  selectedDocuments: Set<string>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BatchClassifyPanel({
  selectedDocuments,
  onClose,
  onSuccess,
}: BatchClassifyPanelProps) {
  const [isClassifying, setIsClassifying] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const [autoApply, setAutoApply] = useState(false);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedForApply, setSelectedForApply] = useState<Set<string>>(new Set());

  const handleClassify = async () => {
    setIsClassifying(true);
    setError(null);
    setClassifications([]);
    setStats(null);

    try {
      const response = await fetch('/api/admin/documents/batch-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: Array.from(selectedDocuments),
          useAI,
          autoApply,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao classificar documentos');
      }

      const data = await response.json();
      setClassifications(data.classifications || []);
      setStats(data.stats);

      // Se autoApply estava ativo, já foram aplicadas
      if (autoApply) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (err) {
      console.error('Erro ao classificar:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsClassifying(false);
    }
  };

  const toggleSelection = (docId: string) => {
    const newSet = new Set(selectedForApply);
    if (newSet.has(docId)) {
      newSet.delete(docId);
    } else {
      newSet.add(docId);
    }
    setSelectedForApply(newSet);
  };

  const selectAllHighConfidence = () => {
    const highConfidence = classifications
      .filter(c => c.suggested.confidence >= 70 && !c.applied)
      .map(c => c.documentId);
    setSelectedForApply(new Set(highConfidence));
  };

  const applySelectedClassifications = async () => {
    if (selectedForApply.size === 0) {
      alert('Selecione pelo menos uma classificação para aplicar');
      return;
    }

    setIsClassifying(true);

    try {
      // Aplicar classificações selecionadas
      const toApply = classifications.filter(c => selectedForApply.has(c.documentId));

      const promises = toApply.map(async (c) => {
        const response = await fetch(`/api/admin/documents/${c.documentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: c.suggested.courseIds[0],
            category: c.suggested.category,
            tags: c.suggested.tags.join(', '),
          }),
        });

        if (!response.ok) {
          throw new Error(`Erro ao atualizar documento ${c.title}`);
        }
      });

      await Promise.all(promises);

      alert(`${selectedForApply.size} documento(s) atualizado(s) com sucesso!`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erro ao aplicar classificações:', err);
      alert('Erro ao aplicar classificações. Veja o console para detalhes.');
    } finally {
      setIsClassifying(false);
    }
  };

  const getCourseTitle = (courseId: string): string => {
    const course = courses.find(c => c.id === courseId);
    return course?.title || courseId;
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBadge = (confidence: number): string => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-lg">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Classificação Automática em Lote</h2>
                <p className="text-purple-100 mt-1">
                  {selectedDocuments.size} documento(s) selecionado(s)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Configurações */}
        {classifications.length === 0 && (
          <div className="p-6 border-b bg-gray-50">
            <h3 className="font-bold text-lg mb-4">Configurações de Classificação</h3>

            <div className="space-y-4">
              {/* Usar IA */}
              <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:border-purple-500 transition-colors">
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={(e) => setUseAI(e.target.checked)}
                  className="w-5 h-5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold">Usar Claude AI (Análise Avançada)</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Usa IA para documentos com baixa confiança. Mais preciso, porém mais lento.
                  </p>
                </div>
              </label>

              {/* Auto-aplicar */}
              <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:border-purple-500 transition-colors">
                <input
                  type="checkbox"
                  checked={autoApply}
                  onChange={(e) => setAutoApply(e.target.checked)}
                  className="w-5 h-5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    <span className="font-semibold">Aplicar Automaticamente (Alta Confiança)</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Aplica classificações automaticamente para confiança ≥ 70%. Requer revisão posterior.
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleClassify}
                disabled={isClassifying}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 font-medium"
              >
                {isClassifying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Classificando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Classificar Documentos
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 m-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Erro: {error}</span>
            </div>
          </div>
        )}

        {/* Estatísticas */}
        {stats && (
          <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{stats.classified}</div>
                <div className="text-sm text-gray-600 mt-1">Classificados</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.autoApplied}</div>
                <div className="text-sm text-gray-600 mt-1">Aplicados</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{stats.averageConfidence}%</div>
                <div className="text-sm text-gray-600 mt-1">Confiança Média</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-600">{stats.bySource.claude}</div>
                <div className="text-sm text-gray-600 mt-1">Via IA</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.bySource.basic}</div>
                <div className="text-sm text-gray-600 mt-1">Via Regras</div>
              </div>
            </div>
          </div>
        )}

        {/* Resultados */}
        {classifications.length > 0 && !autoApply && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Resultados da Classificação</h3>
              <div className="flex gap-2">
                <button
                  onClick={selectAllHighConfidence}
                  className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  Selecionar Alta Confiança (≥70%)
                </button>
                <button
                  onClick={applySelectedClassifications}
                  disabled={selectedForApply.size === 0 || isClassifying}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Aplicar Selecionados ({selectedForApply.size})
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {classifications.map((classification) => (
                <div
                  key={classification.documentId}
                  className={`border-2 rounded-lg p-4 transition-all ${
                    selectedForApply.has(classification.documentId)
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  } ${classification.applied ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    {!classification.applied && (
                      <input
                        type="checkbox"
                        checked={selectedForApply.has(classification.documentId)}
                        onChange={() => toggleSelection(classification.documentId)}
                        className="mt-1 w-5 h-5 cursor-pointer"
                      />
                    )}

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 line-clamp-2">
                            {classification.title}
                          </h4>
                          {classification.applied && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded">
                              ✓ Já Aplicado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${getConfidenceBadge(classification.suggested.confidence)}`}>
                            {classification.suggested.confidence}%
                          </span>
                          {classification.suggested.source === 'claude' && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                              🤖 IA
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Sugestões */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {/* Curso */}
                        <div>
                          <span className="text-gray-500 font-medium">Curso:</span>
                          <div className="mt-1">
                            {classification.current.courseId && (
                              <div className="text-gray-700">
                                <span className="text-xs text-gray-500">Atual:</span> {getCourseTitle(classification.current.courseId)}
                              </div>
                            )}
                            <div className="text-purple-700 font-medium">
                              <span className="text-xs text-gray-500">Sugerido:</span> {getCourseTitle(classification.suggested.courseIds[0])}
                            </div>
                          </div>
                        </div>

                        {/* Categoria */}
                        <div>
                          <span className="text-gray-500 font-medium">Categoria:</span>
                          <div className="mt-1">
                            <div className="text-gray-700">
                              <span className="text-xs text-gray-500">Atual:</span> {classification.current.category}
                            </div>
                            <div className="text-purple-700 font-medium">
                              <span className="text-xs text-gray-500">Sugerido:</span> {classification.suggested.category}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tags */}
                      {classification.suggested.tags.length > 0 && (
                        <div className="mt-3">
                          <span className="text-xs text-gray-500 font-medium">Tags Sugeridas:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {classification.suggested.tags.map((tag, i) => (
                              <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reasoning (Claude) */}
                      {classification.suggested.reasoning && (
                        <div className="mt-3 p-3 bg-indigo-50 rounded-lg">
                          <span className="text-xs text-indigo-700 font-medium">💭 Raciocínio da IA:</span>
                          <p className="text-sm text-indigo-900 mt-1">{classification.suggested.reasoning}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
