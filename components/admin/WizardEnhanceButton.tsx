'use client';

import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface WizardEnhanceButtonProps {
  /** Título do documento — obrigatório (LeiIndexer/Claude precisam de algo para analisar). */
  title: string;
  /** Descrição curta opcional. */
  description?: string;
  /** Categoria (acordao, parecer, etc) — afeta threshold do LeiIndexer. */
  category: string;
  /** Artigos da Lei 14.133 já selecionados (preserva união ao aplicar). */
  currentSelectedArticles: string[];
  /** Callback com a união (atuais ∪ sugestões aceitas). */
  onApplySuggestions: (articles: string[]) => void;
  disabled?: boolean;
}

interface SuggestionItem {
  articleNumber: number;
  confidence: number;
}

interface EnhanceResponse {
  success: boolean;
  enhancement?: {
    leiArticles: number[];
    confidence: number;
    reasoning: string;
    tags: string[];
    suggestedImportance?: string;
  };
  error?: string;
}

function confidenceBadge(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Alta', color: 'bg-green-100 text-green-800' };
  if (score >= 60) return { label: 'Média', color: 'bg-yellow-100 text-yellow-800' };
  return { label: 'Baixa', color: 'bg-gray-100 text-gray-800' };
}

export default function WizardEnhanceButton({
  title,
  description,
  category,
  currentSelectedArticles,
  onApplySuggestions,
  disabled = false,
}: WizardEnhanceButtonProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState('');
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [overallConfidence, setOverallConfidence] = useState(0);

  const handleAnalyze = async () => {
    if (!title || title.trim() === '') {
      setError('É necessário preencher o título para análise.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setSuggestions([]);
    setSelected(new Set());
    setReasoning('');
    setSuggestedTags([]);

    try {
      const response = await fetch('/api/admin/documents/temp-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: description || '', category }),
      });

      const data = (await response.json()) as EnhanceResponse;

      if (!response.ok || !data.success || !data.enhancement) {
        throw new Error(data.error || 'Erro ao analisar documento');
      }

      const items: SuggestionItem[] = (data.enhancement.leiArticles || []).map((n) => ({
        articleNumber: n,
        confidence: data.enhancement!.confidence,
      }));

      setSuggestions(items);
      setReasoning(data.enhancement.reasoning || '');
      setSuggestedTags(data.enhancement.tags || []);
      setOverallConfidence(data.enhancement.confidence);

      // Pré-seleciona todas (LeiIndexer já filtra por minConfidence — o que chega é bom)
      setSelected(new Set(items.map((i) => i.articleNumber)));

      setDialogOpen(true);
    } catch (err) {
      console.error('Erro ao analisar documento:', err);
      setError(err instanceof Error ? err.message : 'Erro ao analisar documento');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggle = (articleNumber: number) => {
    const next = new Set(selected);
    if (next.has(articleNumber)) next.delete(articleNumber);
    else next.add(articleNumber);
    setSelected(next);
  };

  const handleApply = () => {
    // Mantém artigos já selecionados + adiciona novos (como string[] para o contract atual)
    const newOnes = Array.from(selected).map(String);
    const combined = Array.from(new Set([...currentSelectedArticles, ...newOnes]));
    onApplySuggestions(combined);
    setDialogOpen(false);
  };

  const badge = confidenceBadge(overallConfidence);

  return (
    <>
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

        {error && (
          <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-xs text-gray-500 flex items-start gap-1">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            O sistema analisará o título e descrição para sugerir artigos relevantes da Lei 14.133/2021.
          </span>
        </p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sugestões de Artigos da Lei 14.133/2021</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {suggestions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium">Nenhum artigo sugerido</p>
                <p className="text-sm mt-1">
                  A IA não identificou artigos relevantes — pode ser que o documento não trate diretamente da Lei 14.133/2021.
                </p>
                {reasoning && (
                  <p className="text-xs mt-3 text-gray-600 italic max-w-md mx-auto">{reasoning}</p>
                )}
              </div>
            ) : (
              <>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-purple-900 font-medium">
                      {suggestions.length} {suggestions.length === 1 ? 'artigo sugerido' : 'artigos sugeridos'}
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${badge.color}`}>
                      Confiança {badge.label}: {overallConfidence}%
                    </span>
                  </div>
                  {reasoning && <p className="text-xs text-purple-700 italic">{reasoning}</p>}
                  {suggestedTags.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-purple-200">
                      <p className="text-xs text-purple-700 mb-1">Tags sugeridas:</p>
                      <div className="flex flex-wrap gap-1">
                        {suggestedTags.map((t) => (
                          <span key={t} className="text-xs bg-white border border-purple-300 text-purple-700 px-2 py-0.5 rounded">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {suggestions.map((s) => (
                    <div
                      key={s.articleNumber}
                      className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                        selected.has(s.articleNumber)
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggle(s.articleNumber)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-700">Art. {s.articleNumber}</span>
                        {selected.has(s.articleNumber) ? (
                          <CheckCircle2 className="w-5 h-5 text-purple-600" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-gray-600">
                    {selected.size} {selected.size === 1 ? 'artigo selecionado' : 'artigos selecionados'}
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
                      disabled={selected.size === 0}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Aplicar Selecionados
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
