'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, MessageSquare, FileText, RefreshCw, AlertCircle } from 'lucide-react';

interface Source {
  id: string;
  title: string;
  category: string;
  excerpt: string;
}

interface ArticleChatInterfaceProps {
  articleNumber: string;
  articleTitle?: string;
}

export default function ArticleChatInterface({
  articleNumber,
  articleTitle,
}: ArticleChatInterfaceProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  // Carregar conversationId do localStorage ao montar
  useEffect(() => {
    const savedConvId = localStorage.getItem(`chat_art_${articleNumber}`);
    if (savedConvId) {
      setConversationId(savedConvId);
    }
  }, [articleNumber]);

  // Scroll para resposta quando aparecer
  useEffect(() => {
    if (answer && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [answer]);

  const handleSubmit = async () => {
    // Validações
    if (!question.trim()) {
      setError('Por favor, digite uma pergunta.');
      return;
    }

    if (question.trim().length < 5) {
      setError('A pergunta deve ter pelo menos 5 caracteres.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(`/api/artigos/${articleNumber}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question.trim(),
          conversationId: conversationId || undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Você precisa estar logado para usar o chat. Por favor, acesse a área restrita.');
        } else if (response.status === 404) {
          throw new Error('Artigo não encontrado.');
        } else if (response.status === 500) {
          throw new Error('Erro ao consultar IA. Tente novamente em alguns instantes.');
        } else {
          throw new Error('Erro ao processar pergunta. Tente novamente.');
        }
      }

      const data = await response.json();

      // Salvar conversationId
      if (data.conversationId) {
        localStorage.setItem(`chat_art_${articleNumber}`, data.conversationId);
        setConversationId(data.conversationId);
      }

      setAnswer(data.answer);
      setSources(data.sources || []);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('A consulta está demorando muito. Tente novamente.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Erro inesperado ao consultar IA.');
      }
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewQuestion = () => {
    setQuestion('');
    setAnswer(null);
    setSources([]);
    setError(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter para enviar
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl shadow-lg border-2 border-purple-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Pergunte à IA</h3>
            <p className="text-white/90 text-sm">
              {articleTitle ? articleTitle : `Artigo ${articleNumber} da Lei 14.133/2021`}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Input Area */}
        {!answer && (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua pergunta sobre este artigo... (Ex: O que significa este artigo? Quais são os requisitos?)"
                className="w-full min-h-[120px] px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 resize-y transition-all"
                maxLength={500}
                disabled={isLoading}
                aria-label="Campo de pergunta"
              />
              <div className="absolute bottom-3 right-3 text-xs text-gray-500">
                {question.length}/500
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isLoading || !question.trim()}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              aria-label="Perguntar à IA"
            >
              <Sparkles className="w-5 h-5" />
              Perguntar à IA
            </button>

            <p className="text-xs text-center text-gray-600">
              💡 Dica: Use <kbd className="px-2 py-1 bg-gray-200 rounded">Ctrl</kbd> + <kbd className="px-2 py-1 bg-gray-200 rounded">Enter</kbd> para enviar
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
            <p className="text-gray-700 font-medium">Consultando IA especializada...</p>
            <p className="text-sm text-gray-600">Analisando artigo e documentos relacionados</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium mb-2">{error}</p>
              <button
                onClick={handleNewQuestion}
                className="text-sm text-red-700 hover:text-red-800 underline"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {/* Answer Display */}
        {answer && !isLoading && (
          <div ref={answerRef} className="space-y-4 animate-fade-in">
            {/* Question Asked */}
            <div className="p-4 bg-white rounded-lg border-2 border-gray-200">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600 font-medium mb-1">Sua pergunta:</p>
                  <p className="text-gray-900">{question}</p>
                </div>
              </div>
            </div>

            {/* AI Answer */}
            <div className="p-6 bg-white rounded-lg border-2 border-purple-200 shadow-md">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-bold text-purple-900 text-lg">Resposta da IA</p>
                  <p className="text-sm text-purple-700">Especializada em Lei 14.133/2021</p>
                </div>
              </div>

              <div className="prose prose-sm max-w-none">
                <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {answer}
                </div>
              </div>
            </div>

            {/* Sources */}
            {sources.length > 0 && (
              <div className="p-5 bg-blue-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h4 className="font-bold text-blue-900">
                    Fontes Consultadas ({sources.length})
                  </h4>
                </div>

                <div className="space-y-3">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className="p-3 bg-white rounded-lg border border-blue-200 hover:border-blue-400 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                              {source.category}
                            </span>
                          </div>
                          <p className="font-semibold text-gray-900 text-sm mb-1">
                            {source.title}
                          </p>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {source.excerpt}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Question Button */}
            <button
              onClick={handleNewQuestion}
              className="w-full px-6 py-3 bg-white border-2 border-purple-300 text-purple-700 rounded-lg font-semibold hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
              aria-label="Fazer nova pergunta"
            >
              <RefreshCw className="w-5 h-5" />
              Fazer Nova Pergunta
            </button>
          </div>
        )}

        {/* Info Footer */}
        {!answer && !isLoading && (
          <div className="pt-4 border-t border-purple-200">
            <p className="text-xs text-center text-gray-600">
              💡 A IA analisa o texto do artigo e documentos relacionados (ONs, Pareceres, Acórdãos) para fornecer respostas contextualizadas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
