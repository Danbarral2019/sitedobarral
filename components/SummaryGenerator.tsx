'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Check, X, RefreshCw, Edit2, Eye } from 'lucide-react';

interface SummaryGeneratorProps {
  documentId: string;
  documentTitle: string;
  currentSummary?: string | null;
  onSummaryGenerated?: (summary: string) => void;
}

interface GeneratedSummary {
  summary: string;
  highlights: string[];
  tags: string[];
  leiArticles: number[];
  confidence: number;
  reasoning?: string;
  generatedAt?: Date;
}

export default function SummaryGenerator({
  documentId,
  documentTitle,
  currentSummary,
  onSummaryGenerated,
}: SummaryGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<GeneratedSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedSummary(null);

    try {
      const response = await fetch(`/api/admin/documents/${documentId}/generate-summary`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao gerar resumo');
      }

      const data = await response.json();
      setGeneratedSummary(data.summary);
      setShowPreview(true);

      // Notifica componente pai
      if (onSummaryGenerated) {
        onSummaryGenerated(data.summary.summary);
      }

    } catch (err) {
      console.error('Erro ao gerar resumo:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja remover o resumo gerado?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/documents/${documentId}/generate-summary`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao remover resumo');
      }

      setGeneratedSummary(null);
      setShowPreview(false);

      if (onSummaryGenerated) {
        onSummaryGenerated('');
      }

      alert('Resumo removido com sucesso!');
    } catch (err) {
      console.error('Erro ao remover resumo:', err);
      alert('Erro ao remover resumo');
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-4">
      {/* Header com Ações */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Resumo Automático (IA)
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Gere um resumo executivo do documento usando inteligência artificial
          </p>
        </div>

        <div className="flex gap-2">
          {currentSummary && !isGenerating && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? 'Ocultar' : 'Ver Resumo'}
            </button>
          )}

          {currentSummary ? (
            <>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm font-medium"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Regenerar
                  </>
                )}
              </button>
              <button
                onClick={handleDelete}
                disabled={isGenerating}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <X className="w-4 h-4" />
                Remover
              </button>
            </>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm font-medium shadow-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando Resumo...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar Resumo com IA
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
          <div className="flex items-center gap-2 text-red-800">
            <X className="w-5 h-5" />
            <span className="font-medium">Erro: {error}</span>
          </div>
        </div>
      )}

      {/* Preview do Resumo Gerado */}
      {showPreview && generatedSummary && (
        <div className="border-2 border-purple-200 rounded-xl p-6 bg-gradient-to-br from-purple-50 to-indigo-50">
          {/* Confiança */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-700">Confiança da IA:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${getConfidenceBadge(generatedSummary.confidence)}`}>
              {generatedSummary.confidence}%
            </span>
          </div>

          {/* Resumo */}
          <div className="mb-4">
            <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              Resumo Executivo
            </h4>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-800 leading-relaxed whitespace-pre-line">
                {generatedSummary.summary}
              </p>
            </div>
          </div>

          {/* Destaques */}
          {generatedSummary.highlights.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-bold text-gray-900 mb-2">
                📌 Destaques Principais
              </h4>
              <ul className="space-y-2">
                {generatedSummary.highlights.map((highlight, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-800">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tags */}
          {generatedSummary.tags.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-bold text-gray-900 mb-2">
                🏷️ Tags Sugeridas
              </h4>
              <div className="flex flex-wrap gap-2">
                {generatedSummary.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Artigos da Lei */}
          {generatedSummary.leiArticles.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-bold text-gray-900 mb-2">
                📖 Artigos da Lei 14.133/2021 Citados
              </h4>
              <div className="flex flex-wrap gap-2">
                {generatedSummary.leiArticles.map((article, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold"
                  >
                    Art. {article}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Raciocínio */}
          {generatedSummary.reasoning && (
            <div className="mt-4 p-3 bg-indigo-100 rounded-lg">
              <h4 className="text-xs font-bold text-indigo-900 mb-1">💭 Raciocínio da IA:</h4>
              <p className="text-xs text-indigo-800">{generatedSummary.reasoning}</p>
            </div>
          )}
        </div>
      )}

      {/* Resumo Atual (se existir e não for o recém-gerado) */}
      {currentSummary && !showPreview && (
        <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-sm font-bold text-gray-900">Resumo Salvo</span>
          </div>
          <p className="text-sm text-gray-700 line-clamp-3">{currentSummary}</p>
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>💡 Dica:</strong> O resumo é gerado automaticamente pela IA com base no título e descrição.
          Você pode editá-lo manualmente no campo acima antes de salvar. O resumo aparecerá para os alunos na área restrita.
        </p>
      </div>
    </div>
  );
}
