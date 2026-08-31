'use client';

import {
  Sparkles,
  X,
  Loader2,
  Scale,
  FileText,
  ChevronRight,
  ExternalLink,
  MessageSquareQuote,
  AlertCircle,
} from 'lucide-react';
import { isLiteralSourceCategory } from '@/lib/literal-sources';

export interface AISearchResult {
  articleNumber: string;
  title: string;
  ementa: string;
  capitulo: string;
  relevance: string;
  score: number;
}

export interface AIDocumentResult {
  id: string;
  title: string;
  category: string;
  type: string;
  summary: string | null;
  linkedArticles: string[];
  relevance: string;
}

export interface AIEnunciadoResult {
  id: string;
  orgao: string;
  numero: number;
  texto: string;
  tema: string;
  artigosVinculados: string[];
}

export interface AISearchResponse {
  query: string;
  results: AISearchResult[];
  documents: AIDocumentResult[];
  enunciados: AIEnunciadoResult[];
  summary: string;
  isAISearch: boolean;
  cached: boolean;
  latency: number;
}

interface LeiAISearchResultsProps {
  isSearching: boolean;
  results: AISearchResponse | null;
  onClose: () => void;
  onResultClick: (articleNumber: string) => void;
}

export function LeiAISearchResults({ isSearching, results, onClose, onResultClick }: LeiAISearchResultsProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 px-4">
      <div className="bg-white rounded-[6px] w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col border border-border-subtle">
        <div className="bg-brand-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6" />
            <div>
              <h3 className="font-bold text-lg">Busca Inteligente</h3>
              <p className="text-sm text-brand-200">{results?.query ? `"${results.query}"` : 'Processando...'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-[6px] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-brand-600 mb-4" />
              <p className="text-ink-muted">Analisando sua pergunta com IA...</p>
              <p className="text-sm text-ink-muted mt-2">Isso pode levar alguns segundos</p>
            </div>
          ) : results ? (
            <AIResultsContent results={results} onResultClick={onResultClick} />
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-ink-muted">Erro ao processar sua busca.</p>
              <p className="text-sm text-ink-muted mt-2">Por favor, tente novamente.</p>
            </div>
          )}
        </div>

        <div className="border-t border-border-subtle p-4 bg-surface-raised">
          <p className="text-xs text-ink-muted text-center">
            Busca semântica powered by Gemini AI • Clique em um artigo para navegar
          </p>
        </div>
      </div>
    </div>
  );
}

function AIResultsContent({
  results,
  onResultClick,
}: {
  results: AISearchResponse;
  onResultClick: (n: string) => void;
}) {
  const noResults =
    results.results.length === 0 &&
    (!results.documents || results.documents.length === 0) &&
    (!results.enunciados || results.enunciados.length === 0);

  return (
    <div className="space-y-4">
      {results.summary && (
        <div className="bg-brand-50 border-l-4 border-brand-500 p-4 rounded-r-[6px]">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <h4 className="font-bold text-brand-900 text-sm">Resumo</h4>
          </div>
          <p className="text-ink-secondary text-sm">{results.summary}</p>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-ink-muted">
        <span>{results.results.length} artigo(s) encontrado(s)</span>
        <span>{results.latency}ms</span>
        {results.cached && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">cache</span>}
      </div>

      {results.results.length > 0 && (
        <>
          <h4 className="font-bold text-ink-primary text-sm flex items-center gap-2">
            <Scale className="w-4 h-4 text-brand-600" />
            Artigos Relevantes ({results.results.length})
          </h4>
          <div className="space-y-3">
            {results.results.map((result, index) => (
              <button
                key={result.articleNumber}
                onClick={() => onResultClick(result.articleNumber)}
                className="w-full text-left bg-white border border-border-subtle rounded-[6px] p-4 hover:border-brand-300 hover: transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-brand-600">Art. {result.articleNumber}</span>
                      <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                        {result.score}% relevante
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted mb-2">{result.title}</p>
                    <div className="bg-surface-raised rounded p-2 mb-2">
                      <p className="text-sm text-ink-secondary">{result.relevance}</p>
                    </div>
                    <p className="text-xs text-ink-muted line-clamp-2">{result.ementa}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-ink-muted flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {results.documents && results.documents.length > 0 && (
        <>
          <h4 className="font-bold text-ink-primary text-sm flex items-center gap-2 mt-6">
            <FileText className="w-4 h-4 text-green-600" />
            Documentos Relacionados ({results.documents.length})
          </h4>
          <div className="space-y-2">
            {results.documents.map((doc) => (
              <a
                key={doc.id}
                href={doc.type === 'legislativeAct' ? `/api/legislative-acts/${doc.id}` : `/api/documents/${doc.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-left bg-white border border-border-subtle rounded-[6px] p-3 hover:border-green-300 hover: transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-ink-primary text-sm truncate">{doc.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{doc.category}</span>
                      <span className="text-xs text-ink-muted">{doc.relevance}</span>
                    </div>
                    {!isLiteralSourceCategory(doc.category) && doc.summary && (
                      <p className="text-xs text-ink-muted line-clamp-2">{doc.summary}</p>
                    )}
                  </div>
                  <ExternalLink className="w-4 h-4 text-ink-muted flex-shrink-0" />
                </div>
              </a>
            ))}
          </div>
        </>
      )}

      {results.enunciados && results.enunciados.length > 0 && (
        <>
          <h4 className="font-bold text-ink-primary text-sm flex items-center gap-2 mt-6">
            <MessageSquareQuote className="w-4 h-4 text-brand-600" />
            Enunciados Interpretativos ({results.enunciados.length})
          </h4>
          <div className="space-y-2">
            {results.enunciados.map((enunciado) => (
              <div
                key={enunciado.id}
                className="bg-white border border-border-subtle rounded-[6px] p-3 hover:border-brand-300 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center">
                    <MessageSquareQuote className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-brand-600 text-white text-xs font-bold rounded">
                        {enunciado.orgao} {enunciado.numero}
                      </span>
                      <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded">
                        {enunciado.tema}
                      </span>
                    </div>
                    <p className="text-sm text-ink-secondary line-clamp-3">{enunciado.texto}</p>
                    {enunciado.artigosVinculados.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {enunciado.artigosVinculados.slice(0, 5).map((art) => (
                          <span key={art} className="text-xs text-brand-600">Art. {art}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {noResults && (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-ink-muted mx-auto mb-3" />
          <p className="text-ink-muted">Nenhum artigo, documento ou enunciado encontrado para sua busca.</p>
          <p className="text-sm text-ink-muted mt-2">Tente reformular sua pergunta.</p>
        </div>
      )}
    </div>
  );
}
