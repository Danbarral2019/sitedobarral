'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, MessageSquare, FileText, RefreshCw, AlertCircle, ThumbsUp, ThumbsDown, History, Lightbulb, FileDown } from 'lucide-react';
import ArticleChatHistory from './ArticleChatHistory';
import { getSuggestedQuestions } from '@/data/lei-14133-suggested-questions';

interface Source {
  id: string;
  title: string;
  category: string;
  excerpt: string;
}

interface HistoryMessage {
  id: string;
  question: string;
  answer: string | null;
  wasHelpful: boolean | null;
  createdAt: string;
  conversationId: string;
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
  const [lastQuestion, setLastQuestion] = useState(''); // Pergunta anterior para exibir na resposta
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  // Buscar sugestões de perguntas para este artigo
  const suggestedQuestions = getSuggestedQuestions(articleNumber);

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

      // Salvar pergunta atual para exibir na resposta
      setLastQuestion(question.trim());
      setAnswer(data.answer);
      setSources(data.sources || []);
      setQuestionId(data.questionId);
      setFeedback(null);
      setFeedbackSubmitted(false);
      // Limpar campo de pergunta para permitir follow-up
      setQuestion('');
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

  const submitFeedback = async (wasHelpful: boolean) => {
    if (!questionId) return;

    try {
      setFeedback(wasHelpful);
      setFeedbackSubmitted(true);

      const response = await fetch(`/api/artigos/${articleNumber}/chat/${questionId}/feedback`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wasHelpful }),
      });

      if (!response.ok) {
        console.error('Erro ao enviar feedback');
        setFeedbackSubmitted(false);
      } else {
        console.log(`✅ Feedback enviado: ${wasHelpful ? 'Positivo' : 'Negativo'}`);
      }
    } catch (error) {
      console.error('Erro ao enviar feedback:', error);
      setFeedbackSubmitted(false);
    }
  };

  const handleNewQuestion = () => {
    setQuestion('');
    setLastQuestion('');
    setAnswer(null);
    setSources([]);
    setError(null);
    setQuestionId(null);
    setFeedback(null);
    setFeedbackSubmitted(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleNewConversation = () => {
    // Limpar tudo incluindo conversationId
    setQuestion('');
    setLastQuestion('');
    setAnswer(null);
    setSources([]);
    setError(null);
    setQuestionId(null);
    setFeedback(null);
    setFeedbackSubmitted(false);
    setConversationId(null);
    localStorage.removeItem(`chat_art_${articleNumber}`);
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

  const handleRestoreMessage = (message: HistoryMessage) => {
    setQuestion(''); // Limpar campo para permitir follow-up
    setLastQuestion(message.question); // Mostrar pergunta restaurada
    setAnswer(message.answer);
    setSources([]); // Sources nao estao no historico por enquanto
    setQuestionId(message.id);
    setFeedback(message.wasHelpful);
    setFeedbackSubmitted(message.wasHelpful !== null);
    setError(null);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuestion(suggestion);
    setError(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleExportPDF = async () => {
    if (!lastQuestion.trim() || !answer) return;

    const { exportCurrentConversation } = await import('@/lib/pdf-generator');
    exportCurrentConversation(
      articleNumber,
      lastQuestion,
      answer,
      articleTitle || `Artigo ${articleNumber} da Lei 14.133/2021`,
      undefined // userName - sera 'Usuario' por padrao
    );
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl shadow-lg border-2 border-purple-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
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
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg transition-colors text-sm font-medium"
            aria-label="Ver histórico de conversas"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Histórico</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Suggested Questions */}
        {!answer && !isLoading && suggestedQuestions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-amber-600" />
              <h4 className="font-semibold text-gray-900">Perguntas Sugeridas</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  disabled={isLoading}
                  className="px-4 py-2 bg-white border-2 border-purple-200 text-gray-700 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

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
                  <p className="text-gray-900">{lastQuestion}</p>
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

              {/* Feedback Buttons */}
              <div className="flex items-center gap-4 mt-6 pt-4 border-t border-purple-200">
                <span className="text-sm text-gray-700 font-medium">Esta resposta foi útil?</span>
                <button
                  onClick={() => submitFeedback(true)}
                  disabled={feedbackSubmitted}
                  className="p-2 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Resposta útil"
                  aria-label="Marcar como útil"
                >
                  <ThumbsUp
                    className={`w-5 h-5 ${
                      feedback === true
                        ? 'text-green-600 fill-current'
                        : 'text-gray-400'
                    }`}
                  />
                </button>
                <button
                  onClick={() => submitFeedback(false)}
                  disabled={feedbackSubmitted}
                  className="p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Resposta não útil"
                  aria-label="Marcar como não útil"
                >
                  <ThumbsDown
                    className={`w-5 h-5 ${
                      feedback === false
                        ? 'text-red-600 fill-current'
                        : 'text-gray-400'
                    }`}
                  />
                </button>
                {feedbackSubmitted && (
                  <span className="text-sm text-green-600 font-medium animate-fade-in">
                    ✓ Obrigado pelo feedback!
                  </span>
                )}
              </div>

              {/* Export PDF Button */}
              <div className="flex justify-end mt-4">
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg text-sm font-medium"
                  aria-label="Exportar conversa como PDF"
                >
                  <FileDown className="w-4 h-4" />
                  Exportar Conversa
                </button>
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

            {/* Follow-up Input */}
            <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-5 h-5 text-purple-600" />
                <h4 className="font-semibold text-gray-900">Continuar Conversa</h4>
                {conversationId && (
                  <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                    Modo Follow-up
                  </span>
                )}
              </div>
              <div className="relative mb-3">
                <textarea
                  ref={textareaRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Faca uma pergunta de acompanhamento... (Ex: E no caso de dispensa? Pode me explicar melhor?)"
                  className="w-full min-h-[80px] px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 resize-y transition-all text-sm"
                  maxLength={500}
                  disabled={isLoading}
                  aria-label="Campo de pergunta de follow-up"
                />
                <div className="absolute bottom-3 right-3 text-xs text-gray-500">
                  {question.length}/500
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !question.trim()}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm"
                  aria-label="Enviar follow-up"
                >
                  <Sparkles className="w-4 h-4" />
                  Perguntar
                </button>
                <button
                  onClick={handleNewConversation}
                  className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-sm"
                  aria-label="Iniciar nova conversa"
                  title="Iniciar uma nova conversa (limpa o contexto)"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Nova Conversa</span>
                </button>
              </div>

              <p className="text-xs text-center text-gray-500 mt-2">
                A IA vai considerar o contexto da conversa anterior ao responder.
              </p>
            </div>
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

      {/* History Modal */}
      <ArticleChatHistory
        articleNumber={articleNumber}
        conversationId={conversationId}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRestoreMessage={handleRestoreMessage}
      />
    </div>
  );
}
