'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, FileText, AlertCircle } from 'lucide-react';

// ===========================
// Types
// ===========================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: DocumentSource[];
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversation history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('chat-history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setMessages(
          parsed.map((msg: any) => ({
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
    setError(null);
    setInput('');

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      console.log('[ChatInterface] Calling API with:', {
        query,
        filters: courseId ? { courseId } : {},
        maxResults,
      });

      // Call API
      const response = await fetch('/api/documents/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          filters: courseId ? { courseId } : {},
          maxResults,
          useCache: true,
        }),
      });

      console.log('[ChatInterface] API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar documentos');
      }

      const data = await response.json();

      // Build assistant response
      let assistantContent = '';

      if (data.results.length === 0) {
        assistantContent =
          'Não encontrei documentos relevantes para sua pergunta. Tente reformular ou fazer uma pergunta mais específica.';
      } else {
        assistantContent = `Encontrei ${data.results.length} documento(s) relevante(s):\n\n`;

        data.results.forEach((result: any, index: number) => {
          const relevancePercent = Math.round(result.relevance * 100);
          assistantContent += `**${index + 1}. ${result.title}** (${relevancePercent}% relevante)\n`;
          assistantContent += `${result.excerpt}\n\n`;
        });

        if (data.cached) {
          assistantContent += '\n_Resposta do cache (instantânea)_';
        }
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        sources: data.results.map((r: any) => ({
          documentId: r.documentId,
          title: r.title,
          category: r.category,
          relevance: r.relevance,
          excerpt: r.excerpt,
          url: r.url,
        })),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      console.log('[ChatInterface] Success! Added assistant message');
    } catch (err) {
      console.error('[ChatInterface] Error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao processar sua pergunta');

      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      console.log('[ChatInterface] Request completed, isLoading = false');
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSubmit(suggestion);
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem('chat-history');
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
          <button
            onClick={clearHistory}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Limpar histórico
          </button>
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
              <p className="text-sm text-gray-500 mb-3">Sugestões:</p>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm text-gray-700"
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
                className={`max-w-3xl rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-300 space-y-2">
                    <p className="text-xs font-semibold text-gray-600">
                      📚 Fontes consultadas:
                    </p>
                    {message.sources.map((source, index) => (
                      <div
                        key={source.documentId}
                        className="text-xs bg-white rounded p-2"
                      >
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-gray-900">
                                {source.title}
                              </span>
                              <span className="text-gray-500">
                                {Math.round(source.relevance * 100)}%
                              </span>
                            </div>
                            <p className="text-gray-600 text-xs mt-1">
                              {source.category}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-xs mt-2 opacity-70">
                  {message.timestamp.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
            </div>
          </div>
        )}

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
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
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
