'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User, Bot, Sparkles } from 'lucide-react';

// ===========================
// Types
// ===========================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: DocumentSource[];
}

interface DocumentSource {
  documentId: string;
  title: string;
  relevance: number;
  excerpt: string;
}

interface ChatInterfaceProps {
  placeholder?: string;
  suggestedQuestions?: string[];
  maxMessages?: number;
  enableHistory?: boolean;
}

// ===========================
// Component
// ===========================

export function ChatInterface({
  placeholder = 'Faça uma pergunta sobre licitações...',
  suggestedQuestions = [
    'Quais são os principais tipos de licitação?',
    'O que é pregão eletrônico?',
    'Quando usar dispensa de licitação?',
    'Quais os requisitos para participar de uma licitação?',
  ],
  maxMessages = 50,
  enableHistory = true,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ===========================
  // Load History from localStorage
  // ===========================

  useEffect(() => {
    if (enableHistory && typeof window !== 'undefined') {
      const saved = localStorage.getItem('chat-history');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setMessages(
            parsed.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            }))
          );
        } catch (error) {
          console.error('Failed to load chat history:', error);
        }
      }
    }
  }, [enableHistory]);

  // ===========================
  // Save History to localStorage
  // ===========================

  useEffect(() => {
    if (enableHistory && typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem('chat-history', JSON.stringify(messages));
    }
  }, [messages, enableHistory]);

  // ===========================
  // Auto-scroll to bottom
  // ===========================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ===========================
  // Handle Send Message
  // ===========================

  const handleSend = async (question: string = input) => {
    if (!question.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call search API
      const response = await fetch('/api/documents/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          query: question.trim(),
          maxResults: 3,
          useCache: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Build assistant response
      let assistantContent = '';
      const sources: DocumentSource[] = [];

      if (data.results.length === 0) {
        assistantContent = 'Desculpe, não encontrei documentos relevantes para responder sua pergunta. Tente reformular ou fazer uma pergunta mais específica.';
      } else {
        // Combine responses from multiple documents
        assistantContent = 'Com base nos documentos disponíveis:\n\n';

        data.results.forEach((result: any, index: number) => {
          assistantContent += `**${index + 1}. ${result.title}**\n\n${result.geminiResponse}\n\n`;

          sources.push({
            documentId: result.documentId,
            title: result.title,
            relevance: result.relevance,
            excerpt: result.excerpt,
          });
        });

        // Add footer with metadata
        if (data.cached) {
          assistantContent += `\n_✨ Resposta em cache (${data.latency}ms)_`;
        } else {
          assistantContent += `\n_⏱️ Consultado em ${(data.latency / 1000).toFixed(1)}s_`;
        }
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ Erro ao processar sua pergunta: ${
          error instanceof Error ? error.message : 'Erro desconhecido'
        }`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // ===========================
  // Handle Suggested Question
  // ===========================

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    handleSend(question);
  };

  // ===========================
  // Handle Clear History
  // ===========================

  const handleClearHistory = () => {
    if (confirm('Deseja limpar todo o histórico de conversas?')) {
      setMessages([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('chat-history');
      }
    }
  };

  // ===========================
  // Handle Key Press (Enter to send)
  // ===========================

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ===========================
  // Render
  // ===========================

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Assistente IA</h2>
            <p className="text-sm text-gray-500">Busca semântica com Google Gemini</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            Limpar histórico
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="p-4 bg-blue-50 rounded-full mb-4">
              <Bot className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Olá! Como posso ajudar?
            </h3>
            <p className="text-gray-600 mb-6 max-w-md">
              Faça perguntas sobre licitações, contratos e documentos do sistema.
            </p>

            {/* Suggested Questions */}
            {suggestedQuestions.length > 0 && (
              <div className="w-full max-w-2xl">
                <p className="text-sm text-gray-500 mb-3">Sugestões de perguntas:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {suggestedQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestedQuestion(question)}
                      className="text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-700 transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="prose prose-sm max-w-none">
                {message.content.split('\n').map((line, i) => {
                  // Basic markdown rendering
                  const isBold = line.startsWith('**') && line.endsWith('**');
                  const isItalic = line.startsWith('_') && line.endsWith('_');

                  if (isBold) {
                    return (
                      <p key={i} className="font-semibold mb-2">
                        {line.slice(2, -2)}
                      </p>
                    );
                  }

                  if (isItalic) {
                    return (
                      <p key={i} className="text-xs opacity-75 mt-2">
                        {line.slice(1, -1)}
                      </p>
                    );
                  }

                  return line ? <p key={i} className="mb-2">{line}</p> : <br key={i} />;
                })}
              </div>

              {/* Sources */}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    Fontes consultadas:
                  </p>
                  <div className="space-y-1">
                    {message.sources.map((source, index) => (
                      <div key={index} className="text-xs text-gray-600">
                        • {source.title} ({(source.relevance * 100).toFixed(0)}% relevante)
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs opacity-50 mt-2">
                {message.timestamp.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>

            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Buscando informações...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Pressione Enter para enviar, Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
