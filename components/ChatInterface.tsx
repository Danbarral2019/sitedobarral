'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Send, Loader2, Sparkles, FileText, AlertCircle, Scale, Gavel, ExternalLink, Download, Share2, Check } from 'lucide-react';
import { trackClientEvent } from '@/lib/monitoring/track-client';
import ArticleAwareMarkdown from './ArticleAwareMarkdown';

// ===========================
// Types
// ===========================

interface LegalSourceItem {
  type: 'lei-article' | 'legislative-act';
  title: string;
  url: string;
  articleNumber?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: DocumentSource[];
  legalSources?: LegalSourceItem[];
  searchHistoryId?: string;
  timestamp: Date;
}

interface DocumentSource {
  documentId: string;
  title: string;
  category: string;
  relevance: number;
  excerpt: string;
  url?: string;
}

interface ChatInterfaceProps {
  courseId?: string;
  maxResults?: number;
  placeholder?: string;
  suggestions?: string[];
  className?: string;
}

// ===========================
// Main Component
// ===========================

export default function ChatInterface({
  courseId,
  maxResults = 5,
  placeholder = 'Faça uma pergunta sobre os documentos do curso...',
  suggestions = [
    'Quais são os principais requisitos para licitação?',
    'Como funciona o pregão eletrônico?',
    'O que diz a lei sobre dispensa de licitação?',
    'Quais são os tipos de contratos administrativos?',
  ],
  className = '',
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const didMountRef = useRef(false);
  const prevMessagesLengthRef = useRef(0);

  // Auto-scroll inteligente:
  //  - Ignora mount inicial (histórico do localStorage).
  //  - Sempre rola quando CHEGA uma nova mensagem (user enviou ou resposta
  //    começou).
  //  - Durante streaming (mesma msg sendo atualizada): só rola se o usuário
  //    já estiver próximo do fim. Se ele subiu para reler, respeita.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      prevMessagesLengthRef.current = messages.length;
      return;
    }

    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;

    if (isNewMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // Streaming update: só rola se user está perto do fim.
    const threshold = 120;
    const nearBottom =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - threshold;
    if (nearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load conversation history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('chat-history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setMessages(
          parsed.map((msg: { timestamp: string }) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }))
        );
      } catch (e) {
        console.error('Failed to load chat history:', e);
      }
    }
  }, []);

  // Save conversation history to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chat-history', JSON.stringify(messages));
    }
  }, [messages]);

  const handleSubmit = async (queryText?: string) => {
    console.log('[ChatInterface] handleSubmit called', { queryText, input, isLoading });
    const query = queryText || input.trim();
    if (!query || isLoading) {
      console.log('[ChatInterface] Submit blocked', { query, isLoading });
      return;
    }

    console.log('[ChatInterface] Proceeding with query:', query);
    trackClientEvent('chat_message_sent', { query_length: query.length });
    setError(null);
    setInput('');

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    // Cancel previous request if still in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Build conversation history from recent messages
      const recentMessages = [...messages, userMessage].slice(-10);
      const conversationHistory = recentMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      console.log('[ChatInterface] Calling API with:', {
        query,
        filters: courseId ? { courseId } : {},
        maxResults,
        historyLength: conversationHistory.length,
      });

      // Call API with streaming
      const response = await fetch('/api/documents/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          filters: courseId ? { courseId } : {},
          maxResults,
          useCache: true,
          conversationHistory,
          stream: true,
        }),
        signal: controller.signal,
      });

      console.log('[ChatInterface] API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar documentos');
      }

      // Create placeholder assistant message for streaming
      const assistantId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Read SSE stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'meta') {
              // Update sources and legal sources
              setMessages((prev) => prev.map(m =>
                m.id === assistantId
                  ? {
                      ...m,
                      sources: (parsed.results || []).map((r: { documentId: string; title: string; category: string; relevance: number; excerpt: string; url?: string }) => ({
                        documentId: r.documentId,
                        title: r.title,
                        category: r.category,
                        relevance: r.relevance,
                        excerpt: r.excerpt,
                        url: r.url,
                      })),
                      legalSources: parsed.legalSources || undefined,
                    }
                  : m
              ));
            } else if (parsed.type === 'token') {
              fullContent += parsed.text;
              setMessages((prev) => prev.map(m =>
                m.id === assistantId ? { ...m, content: fullContent } : m
              ));
            }
          } catch { /* ignore parse errors */ }
        }
      }

      // If no content was streamed, show fallback — distingue entre "sem
      // fontes" (base não indexou nada) e "fontes encontradas mas a síntese
      // da IA falhou" (timeout, rate limit, safety filter).
      if (!fullContent) {
        setMessages((prev) => prev.map(m => {
          if (m.id !== assistantId) return m;
          const hasSources =
            (m.sources && m.sources.length > 0) ||
            (m.legalSources && m.legalSources.length > 0);
          return {
            ...m,
            content: hasSources
              ? 'Não consegui gerar uma síntese agora — o modelo de IA pode estar sobrecarregado ou indisponível. Encontrei as fontes relevantes abaixo; tente perguntar de novo em alguns instantes.'
              : 'Não encontrei documentos relevantes para sua pergunta. Tente reformular ou fazer uma pergunta mais específica.',
          };
        }));
      }

      // Salvar no historico e capturar o ID para compartilhamento
      if (fullContent) {
        try {
          const currentMsg = (await new Promise<Message | undefined>(resolve => {
            setMessages(prev => {
              const msg = prev.find(m => m.id === assistantId);
              resolve(msg);
              return prev;
            });
          }));

          const historyRes = await fetch('/api/area-restrita/search-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query,
              aiAnswer: fullContent,
              sources: currentMsg?.sources?.map(s => ({ title: s.title, category: s.category, url: s.url })),
              legalSources: currentMsg?.legalSources?.map(s => ({ type: s.type, title: s.title, url: s.url })),
            }),
          });
          if (historyRes.ok) {
            const { id: historyId } = await historyRes.json();
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, searchHistoryId: historyId } : m
            ));
          }
        } catch {
          // Non-critical, silently ignore
        }
      }

      console.log('[ChatInterface] Streaming complete!');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled, ignore
      }
      console.error('[ChatInterface] Error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao processar sua pergunta');

      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSubmit(suggestion);
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem('chat-history');
  };

  const handleExportMessagePDF = async (message: Message) => {
    if (exportingPdf) return;
    setExportingPdf(message.id);
    try {
      const { generateSearchResultPDF } = await import('@/lib/pdf-generator');
      // Find the user message immediately before this assistant message
      const msgIndex = messages.findIndex(m => m.id === message.id);
      const userMsg = msgIndex > 0 ? messages[msgIndex - 1] : null;
      const query = userMsg?.role === 'user' ? userMsg.content : 'Consulta ao assistente';

      generateSearchResultPDF({
        query,
        answer: message.content,
        sources: message.sources?.map(s => ({ title: s.title, category: s.category, url: s.url })),
        legalSources: message.legalSources?.map(s => ({ type: s.type, title: s.title, url: s.url })),
      });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
    } finally {
      setExportingPdf(null);
    }
  };

  const handleShare = async (message: Message) => {
    if (!message.searchHistoryId || sharingId) return;
    setSharingId(message.id);
    setSharedUrl(null);
    try {
      const res = await fetch(`/api/search-history/${message.searchHistoryId}/share`, {
        method: 'POST',
      });
      if (res.ok) {
        const { url } = await res.json();
        setSharedUrl(url);
        await navigator.clipboard.writeText(url);
        // Limpar estado apos 3 segundos
        setTimeout(() => {
          setSharingId(null);
          setSharedUrl(null);
        }, 3000);
      }
    } catch {
      setSharingId(null);
    }
  };

  const handleExportConversationPDF = async () => {
    if (exportingPdf || messages.length === 0) return;
    setExportingPdf('conversation');
    try {
      const { generateSearchResultPDF } = await import('@/lib/pdf-generator');
      // Use the first user message as the query
      const firstUserMsg = messages.find(m => m.role === 'user');
      const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
      const query = firstUserMsg?.content || 'Conversa com assistente IA';
      const answer = lastAssistantMsg?.content || '';

      // Collect all sources from all assistant messages
      const allSources = messages
        .filter(m => m.role === 'assistant' && m.sources)
        .flatMap(m => m.sources!.map(s => ({ title: s.title, category: s.category, url: s.url })));
      const allLegalSources = messages
        .filter(m => m.role === 'assistant' && m.legalSources)
        .flatMap(m => m.legalSources!.map(s => ({ type: s.type, title: s.title, url: s.url })));

      // Deduplicate sources by title
      const uniqueSources = allSources.filter((s, i, arr) => arr.findIndex(x => x.title === s.title) === i);
      const uniqueLegalSources = allLegalSources.filter((s, i, arr) => arr.findIndex(x => x.title === s.title) === i);

      // Build conversation history for refinements section
      const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));

      generateSearchResultPDF({
        query,
        answer,
        sources: uniqueSources.length > 0 ? uniqueSources : undefined,
        legalSources: uniqueLegalSources.length > 0 ? uniqueLegalSources : undefined,
        conversationHistory,
      });
    } catch (err) {
      console.error('Erro ao gerar PDF da conversa:', err);
    } finally {
      setExportingPdf(null);
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Assistente Inteligente</h3>
        </div>
        {messages.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportConversationPDF}
              disabled={exportingPdf === 'conversation'}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 transition-colors"
              title="Exportar conversa como PDF"
            >
              {exportingPdf === 'conversation' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Exportar PDF
            </button>
            <button
              onClick={clearHistory}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Limpar histórico
            </button>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              Como posso ajudar?
            </h4>
            <p className="text-gray-600 mb-6">
              Faça perguntas sobre os documentos e materiais do curso
            </p>

            {/* Suggestions */}
            <div className="max-w-2xl mx-auto space-y-2">
              <p className="text-sm text-gray-400 mb-3">Sugestões:</p>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm text-gray-600"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`group/msg max-w-3xl rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.role === 'assistant' ? (
                  <ArticleAwareMarkdown content={message.content} />
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}

                {/* Legal Sources */}
                {message.legalSources && message.legalSources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-300 space-y-1">
                    <p className="text-xs font-semibold text-gray-600 mb-1.5">
                      Fundamentação legal:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {message.legalSources.map((ls) => {
                        const IconComp = ls.type === 'lei-article' ? Scale : Gavel;
                        const isExternal = ls.url.startsWith('http');

                        if (isExternal) {
                          return (
                            <a
                              key={ls.title}
                              href={ls.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-800 hover:bg-indigo-100 transition-colors"
                            >
                              <IconComp className="w-3 h-3" />
                              <span className="truncate max-w-[180px]">{ls.title}</span>
                              <ExternalLink className="w-3 h-3 text-indigo-400" />
                            </a>
                          );
                        }

                        return (
                          <Link
                            key={ls.title}
                            href={ls.url}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-800 hover:bg-indigo-100 transition-colors"
                          >
                            <IconComp className="w-3 h-3" />
                            <span className="truncate max-w-[180px]">{ls.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Document Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300 space-y-2">
                    <p className="text-xs font-semibold text-gray-600">
                      Fontes consultadas:
                    </p>
                    {message.sources.map((source) => {
                      const sourceContent = (
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-gray-900">
                                {source.title}
                              </span>
                              <span className="text-gray-400">
                                {Math.round(source.relevance * 100)}%
                              </span>
                            </div>
                            <p className="text-gray-600 text-xs mt-1">
                              {source.category}
                            </p>
                          </div>
                        </div>
                      );

                      if (source.url) {
                        const isExternal = source.url.startsWith('http');
                        if (isExternal) {
                          return (
                            <a
                              key={source.documentId}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs bg-white rounded p-2 hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              {sourceContent}
                            </a>
                          );
                        }
                        return (
                          <Link
                            key={source.documentId}
                            href={source.url}
                            className="block text-xs bg-white rounded p-2 hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            {sourceContent}
                          </Link>
                        );
                      }

                      return (
                        <div
                          key={source.documentId}
                          className="text-xs bg-white rounded p-2"
                        >
                          {sourceContent}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {message.role === 'assistant' && message.content && (
                    <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-all">
                      {message.searchHistoryId && (
                        <button
                          onClick={() => handleShare(message)}
                          disabled={sharingId === message.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-400 hover:text-purple-600 hover:bg-purple-50 disabled:text-gray-400 transition-all"
                          title={sharedUrl && sharingId === message.id ? 'Link copiado!' : 'Compartilhar resposta'}
                        >
                          {sharedUrl && sharingId === message.id ? (
                            <>
                              <Check className="w-3 h-3 text-green-600" />
                              <span className="text-green-600">Copiado!</span>
                            </>
                          ) : sharingId === message.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Share2 className="w-3 h-3" />
                              Compartilhar
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleExportMessagePDF(message)}
                        disabled={exportingPdf === message.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:text-gray-400 transition-all"
                        title="Baixar resposta como PDF"
                      >
                        {exportingPdf === message.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        <div aria-live="polite" aria-atomic="true">
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-600" aria-label="Processando sua pergunta" />
                <span className="sr-only">Processando sua pergunta...</span>
              </div>
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="flex justify-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2 max-w-2xl">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 bg-white text-gray-900"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Enviar</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
