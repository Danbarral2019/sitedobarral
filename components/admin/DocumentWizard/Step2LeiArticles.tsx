'use client';

import { useState } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, Ban, CheckCircle, Loader2, X, Plus } from 'lucide-react';
import LeiArticleSelector from '@/components/LeiArticleSelector';
import { WizardStepProps } from './types';

interface ArticleCoverageStats {
  numero: string;
  documentCount: number;
  status: 'orphan' | 'scarce' | 'medium' | 'good' | 'excellent';
}

const COVERAGE_BADGES = {
  orphan: { icon: Ban, label: 'Órfão', color: 'text-gray-500 bg-gray-100', emoji: '🚫' },
  scarce: { icon: AlertTriangle, label: 'Carente', color: 'text-orange-500 bg-orange-100', emoji: '⚠️' },
  medium: { icon: TrendingUp, label: 'Médio', color: 'text-blue-500 bg-blue-100', emoji: '📘' },
  good: { icon: CheckCircle, label: 'Bom', color: 'text-green-500 bg-green-100', emoji: '✅' },
  excellent: { icon: TrendingUp, label: 'Excelente', color: 'text-emerald-500 bg-emerald-100', emoji: '🔥' },
};

export default function Step2LeiArticles({
  formState,
  updateForm,
  onNext,
  onPrevious,
  documentId,
}: WizardStepProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    articles: number[];
    reasoning: string;
    confidence: number;
    tags: string[];
  } | null>(null);
  const [coverageStats, setCoverageStats] = useState<ArticleCoverageStats[]>([]);
  const [tagInput, setTagInput] = useState('');

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);

    try {
      // Em edição (documentId presente), usar /[id]/enhance — esse endpoint lê
      // extractedText do banco, dando ao LeiIndexer o texto integral em vez de
      // só title/category. Em criação (sem id), cai no temp-enhance.
      const endpoint = documentId
        ? `/api/admin/documents/${documentId}/enhance`
        : '/api/admin/documents/temp-enhance';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formState.title,
          description: formState.description,
          category: formState.category,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao analisar documento com IA');
      }

      const data = await response.json();

      setAiSuggestion({
        articles: data.enhancement.leiArticles || [],
        reasoning: data.enhancement.reasoning || '',
        confidence: data.enhancement.confidence || 0,
        tags: data.enhancement.tags || [],
      });

      // Buscar estatísticas de cobertura dos artigos sugeridos
      if (data.enhancement.leiArticles && data.enhancement.leiArticles.length > 0) {
        const statsResponse = await fetch(
          `/api/admin/analytics/article-coverage?articles=${data.enhancement.leiArticles.join(',')}`
        );

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setCoverageStats(statsData.coverage || []);
        }
      }
    } catch (error) {
      console.error('[Step2] Erro ao analisar com IA:', error);
      alert('Erro ao analisar documento. Tente novamente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAcceptAISuggestions = () => {
    if (aiSuggestion) {
      updateForm({
        leiArticles: aiSuggestion.articles.map((n) => String(n)),
        tags: [...new Set([...formState.tags, ...aiSuggestion.tags])],
      });
      setAiSuggestion(null);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formState.tags.includes(tag)) {
      updateForm({ tags: [...formState.tags, tag] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    updateForm({ tags: formState.tags.filter((t) => t !== tag) });
  };

  const handleKeyDownTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const getCoverageStatus = (articleNumber: string): ArticleCoverageStats | null => {
    return coverageStats.find((s) => s.numero === articleNumber) || null;
  };

  const handleNext = () => {
    // Validação: pelo menos 1 artigo OU justificativa
    if (formState.leiArticles.length === 0) {
      const confirm = window.confirm(
        'Nenhum artigo da Lei 14.133 foi selecionado. Este documento não aparecerá na navegação por artigos. Deseja continuar mesmo assim?'
      );

      if (!confirm) return;
    }

    onNext();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900">Artigos da Lei 14.133/2021</h2>
        <p className="text-sm text-gray-600 mt-1">
          Vincule este documento aos artigos relevantes da Lei 14.133 para facilitar a navegação dos alunos
        </p>
      </div>

      {/* Botão de Análise IA - DESTAQUE */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border-2 border-indigo-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-indigo-900 flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Análise Inteligente com IA
            </h3>
            <p className="text-sm text-indigo-700">
              A IA irá analisar o título, categoria e descrição do documento para sugerir automaticamente
              os artigos da Lei 14.133 relacionados, com justificativa e nível de confiança.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAIAnalysis}
            disabled={isAnalyzing || !formState.title}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Analisar com IA
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sugestões da IA */}
      {aiSuggestion && (
        <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-purple-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Sugestões da IA
            </h3>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
              Confiança: {aiSuggestion.confidence}%
            </span>
          </div>

          {/* Raciocínio da IA */}
          <div className="bg-white p-4 rounded-lg border border-purple-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Justificativa:</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{aiSuggestion.reasoning}</p>
          </div>

          {/* Artigos Sugeridos */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Artigos Sugeridos ({aiSuggestion.articles.length}):
            </h4>
            <div className="flex flex-wrap gap-2">
              {aiSuggestion.articles.map((artNum) => {
                const coverage = getCoverageStatus(String(artNum));
                const badge = coverage ? COVERAGE_BADGES[coverage.status] : null;

                return (
                  <div
                    key={artNum}
                    className="px-4 py-2 bg-white border border-purple-300 rounded-lg text-sm font-medium text-purple-900 flex items-center gap-2"
                  >
                    Art. {artNum}
                    {badge && (
                      <span className={`px-2 py-0.5 rounded text-xs ${badge.color}`}>
                        {badge.emoji} {coverage?.documentCount || 0} docs
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tags Sugeridas */}
          {aiSuggestion.tags.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Tags Sugeridas:</h4>
              <div className="flex flex-wrap gap-2">
                {aiSuggestion.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleAcceptAISuggestions}
              className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              ✅ Aceitar Sugestões
            </button>
            <button
              type="button"
              onClick={() => setAiSuggestion(null)}
              className="px-6 py-2 bg-white text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Seletor de Artigos */}
      <div>
        <LeiArticleSelector
          selectedArticles={formState.leiArticles}
          onChange={(articles) => updateForm({ leiArticles: articles })}
          label="Artigos da Lei 14.133/2021"
          placeholder="Digite o número do artigo (ex: 1, 6, 75)..."
          maxArticles={20}
          showPopularArticles={true}
        />

        {/* Estatísticas dos Artigos Selecionados */}
        {formState.leiArticles.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Artigos Selecionados ({formState.leiArticles.length}):
            </h4>
            <div className="flex flex-wrap gap-2">
              {formState.leiArticles.map((artNum) => {
                const coverage = getCoverageStatus(artNum);
                const badge = coverage ? COVERAGE_BADGES[coverage.status] : null;

                return (
                  <div
                    key={artNum}
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm flex items-center gap-2"
                  >
                    <span className="font-medium text-gray-900">Art. {artNum}</span>
                    {badge && (
                      <span className={`px-2 py-0.5 rounded text-xs ${badge.color}`}>
                        {badge.emoji}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {formState.leiArticles.length === 0 && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              ⚠️ <strong>Atenção:</strong> Documentos sem artigos vinculados não aparecerão na navegação
              por estrutura da Lei 14.133. Considere usar a análise IA ou selecionar artigos manualmente.
            </p>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="border-t pt-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tags (palavras-chave)
        </label>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDownTag}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Digite uma tag e pressione Enter (ex: planejamento, fiscalização)"
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {formState.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formState.tags.map((tag) => (
              <div
                key={tag}
                className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-blue-900 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500 mt-2">
          Tags ajudam na busca e descoberta de documentos relacionados.
        </p>
      </div>

      {/* Botões de Navegação */}
      <div className="flex justify-between items-center pt-6 border-t">
        <button
          type="button"
          onClick={onPrevious}
          className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Voltar
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Próximo: Conteúdo Educacional →
        </button>
      </div>
    </div>
  );
}
