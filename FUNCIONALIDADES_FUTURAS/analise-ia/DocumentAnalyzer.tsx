'use client';

import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Info, FileText, Hash, Tag } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import type { ArticleSuggestion } from '@/lib/document-analyzer';

interface DocumentAnalyzerProps {
  title: string;
  description?: string;
  file?: File | null;
  currentSelectedArticles: string[];
  onApplySuggestions: (articles: string[]) => void;
  disabled?: boolean;
}

export default function DocumentAnalyzer({
  title,
  description,
  file,
  currentSelectedArticles,
  onApplySuggestions,
  disabled = false
}: DocumentAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ArticleSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisStats, setAnalysisStats] = useState<{
    textLength: number;
    citationsFound: number;
    keywordsMatched: number;
    totalSuggestions: number;
    pageCount?: number;
  } | null>(null);

  const handleAnalyze = async () => {
    // Validações
    if (!title || title.trim() === '') {
      setAnalysisError('É necessário preencher o título para análise');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setSuggestions([]);
    setSelectedSuggestions(new Set());

    try {
      let response;

      // Se houver arquivo, tenta análise de PDF (modo 1)
      if (file) {
        const formData = new FormData();
        formData.append('file', file);

        response = await fetch('/api/admin/analyze-document', {
          method: 'POST',
          body: formData
        });

        // Se falhar (ex: PDF não implementado), fallback para análise de metadados
        if (!response.ok) {
          const error = await response.json();
          // Se for erro de implementação, faz fallback automático
          if (error.warning && error.warning.includes('não implementada')) {
            response = await analyzeMetadata();
          } else {
            throw new Error(error.error || 'Erro ao analisar documento');
          }
        }
      } else {
        // Modo 2: Análise de metadados (título + descrição)
        response = await analyzeMetadata();
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao analisar documento');
      }

      setSuggestions(data.suggestions || []);
      setAnalysisStats(data.stats || null);

      // Pré-seleciona sugestões com alta confiança
      const highConfidenceSuggestions = new Set<string>(
        (data.suggestions || [])
          .filter((s: ArticleSuggestion) => s.confidence === 'high' || s.score >= 8)
          .map((s: ArticleSuggestion) => s.articleNumber)
      );

      setSelectedSuggestions(highConfidenceSuggestions);
      setDialogOpen(true);

    } catch (error) {
      console.error('Erro ao analisar documento:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Erro ao analisar documento');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeMetadata = async () => {
    return await fetch('/api/admin/analyze-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description: description || ''
      })
    });
  };

  const toggleSuggestion = (articleNumber: string) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(articleNumber)) {
      newSelected.delete(articleNumber);
    } else {
      newSelected.add(articleNumber);
    }
    setSelectedSuggestions(newSelected);
  };

  const handleApply = async () => {
    // Combina artigos já selecionados + novas sugestões selecionadas
    const combined = [...new Set([...currentSelectedArticles, ...Array.from(selectedSuggestions)])];

    // Rastreia a análise no sistema de analytics
    try {
      await fetch('/api/admin/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentTitle: title,
          documentType: file?.type || 'metadata',
          textLength: analysisStats?.textLength || 0,
          pageCount: analysisStats?.pageCount,
          citationsFound: analysisStats?.citationsFound || 0,
          keywordsMatched: analysisStats?.keywordsMatched || 0,
          suggestions: suggestions,
          acceptedArticles: Array.from(selectedSuggestions)
        })
      });
    } catch (error) {
      console.error('Erro ao rastrear análise:', error);
      // Não bloqueia o fluxo se o tracking falhar
    }

    onApplySuggestions(combined);
    setDialogOpen(false);
  };

  const getConfidenceBadgeColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceLabel = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Média';
      case 'low':
        return 'Baixa';
      default:
        return confidence;
    }
  };

  return (
    <>
      {/* Botão de Análise */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={disabled || isAnalyzing}
          className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Sugerir Artigos Automaticamente
            </>
          )}
        </button>

        {analysisError && (
          <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{analysisError}</span>
          </div>
        )}

        <p className="text-xs text-gray-500 flex items-start gap-1">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            O sistema analisará o {file ? 'arquivo e ' : ''}título/descrição para sugerir artigos relevantes da Lei 14.133/2021
          </span>
        </p>
      </div>

      {/* Dialog de Sugestões */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Sugestões de Artigos da Lei 14.133/2021"
      >
        <div className="space-y-4">
          {suggestions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="font-medium">Nenhum artigo sugerido</p>
              <p className="text-sm mt-1">
                Não foi possível identificar artigos relevantes com base no conteúdo analisado.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-medium mb-1">
                  {suggestions.length} {suggestions.length === 1 ? 'artigo sugerido' : 'artigos sugeridos'}
                </p>
                <p className="text-xs text-blue-700 mb-3">
                  Revise as sugestões e selecione os artigos que deseja adicionar ao documento.
                </p>

                {/* Estatísticas da análise */}
                {analysisStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t border-blue-200">
                    <div className="flex items-center gap-1.5 text-xs">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-blue-800">
                        {analysisStats.pageCount ? (
                          <span><strong>{analysisStats.pageCount}</strong> {analysisStats.pageCount === 1 ? 'página' : 'páginas'}</span>
                        ) : (
                          <span><strong>{Math.floor(analysisStats.textLength / 500)}</strong> parágrafos</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Hash className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-blue-800">
                        <strong>{analysisStats.citationsFound}</strong> {analysisStats.citationsFound === 1 ? 'citação' : 'citações'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Tag className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-blue-800">
                        <strong>{analysisStats.keywordsMatched}</strong> {analysisStats.keywordsMatched === 1 ? 'palavra-chave' : 'palavras-chave'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-blue-800">
                        <strong>{analysisStats.totalSuggestions}</strong> {analysisStats.totalSuggestions === 1 ? 'sugestão' : 'sugestões'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto space-y-3">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.articleNumber}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedSuggestions.has(suggestion.articleNumber)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleSuggestion(suggestion.articleNumber)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-blue-600">
                            Art. {suggestion.articleNumber}º
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${getConfidenceBadgeColor(suggestion.confidence)}`}>
                            {getConfidenceLabel(suggestion.confidence)}
                          </span>
                          <span className="text-xs text-gray-500">
                            Score: {suggestion.score}/10
                          </span>
                        </div>

                        <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                          {suggestion.articleTitle}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {suggestion.sources.map((source, idx) => (
                            <div
                              key={idx}
                              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                              title={source.details}
                            >
                              {source.type === 'citation' && '📌 Citado'}
                              {source.type === 'keyword' && '🔍 Palavra-chave'}
                              {source.type === 'range' && '📊 Range'}
                              {source.type === 'ai' && '🤖 IA'}
                              {source.details && (
                                <span className="text-gray-500"> • {source.details}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {selectedSuggestions.has(suggestion.articleNumber) ? (
                          <CheckCircle2 className="w-6 h-6 text-blue-600" />
                        ) : (
                          <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-gray-600">
                  {selectedSuggestions.size} {selectedSuggestions.size === 1 ? 'artigo selecionado' : 'artigos selecionados'}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDialogOpen(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={selectedSuggestions.size === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Aplicar Selecionados
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}
