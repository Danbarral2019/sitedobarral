'use client';

import { useState, useEffect, useCallback } from 'react';
import { History, X, MessageSquare, Calendar, ThumbsUp, ThumbsDown, Loader2, FileDown } from 'lucide-react';

interface HistoryMessage {
  id: string;
  question: string;
  answer: string | null;
  wasHelpful: boolean | null;
  createdAt: string;
  conversationId: string;
  user?: { name?: string; email?: string };
}

interface ArticleChatHistoryProps {
  articleNumber: string;
  conversationId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRestoreMessage: (message: HistoryMessage) => void;
}

export default function ArticleChatHistory({
  articleNumber,
  conversationId,
  isOpen,
  onClose,
  onRestoreMessage,
}: ArticleChatHistoryProps) {
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = conversationId
        ? `/api/artigos/${articleNumber}/chat/history?conversationId=${conversationId}`
        : `/api/artigos/${articleNumber}/chat/history`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Erro ao buscar histórico');
      }

      const data = await response.json();

      // Se retornou mensagens diretas (conversationId específico)
      if (data.messages) {
        setMessages(data.messages);
      } else if (data.conversations) {
        // Flatten all conversations
        const allMessages: HistoryMessage[] = [];
        Object.values(data.conversations).forEach((conv: unknown) => {
          if (Array.isArray(conv)) {
            allMessages.push(...conv);
          }
        });
        // Sort by date descending
        allMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setMessages(allMessages);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Erro ao carregar histórico de conversas');
    } finally {
      setIsLoading(false);
    }
  }, [articleNumber, conversationId]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, conversationId, fetchHistory]);

  const groupMessagesByDate = (messages: HistoryMessage[]) => {
    const groups: Record<string, HistoryMessage[]> = {};

    messages.forEach((msg) => {
      const date = new Date(msg.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let label: string;
      if (date.toDateString() === today.toDateString()) {
        label = 'Hoje';
      } else if (date.toDateString() === yesterday.toDateString()) {
        label = 'Ontem';
      } else {
        label = date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(msg);
    });

    return groups;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRestore = (message: HistoryMessage) => {
    onRestoreMessage(message);
    onClose();
  };

  const toggleExpand = (messageId: string) => {
    setExpandedMessageId(expandedMessageId === messageId ? null : messageId);
  };

  const handleExportPDF = async () => {
    if (messages.length === 0) return;

    const { generateConversationPDF } = await import('@/lib/pdf-generator');
    generateConversationPDF({
      articleNumber,
      articleTitle: `Artigo ${articleNumber} da Lei 14.133/2021`,
      messages: messages.map((msg) => ({
        question: msg.question,
        answer: msg.answer,
        createdAt: msg.createdAt,
        wasHelpful: msg.wasHelpful,
      })),
      userName: messages[0]?.user?.name || 'Usuário',
      userEmail: messages[0]?.user?.email,
    });
  };

  if (!isOpen) return null;

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[6px] max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-border-subtle">
        {/* Header */}
        <div className="bg-brand-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-[6px]">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Histórico de Conversas</h3>
                <p className="text-white/90 text-sm">
                  Artigo {articleNumber} da Lei 14.133/2021
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-[6px] transition-colors text-sm font-medium"
                  aria-label="Exportar PDF"
                >
                  <FileDown className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar PDF</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-[6px] transition-colors"
                aria-label="Fechar histórico"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-brand-600 mb-4" />
              <p className="text-ink-muted">Carregando histórico...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-[6px] text-center">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {!isLoading && !error && messages.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-ink-muted mx-auto mb-4" />
              <p className="text-ink-muted text-lg font-medium">
                Nenhuma conversa encontrada
              </p>
              <p className="text-ink-muted text-sm mt-2">
                Suas perguntas anteriores aparecerão aqui
              </p>
            </div>
          )}

          {!isLoading && !error && messages.length > 0 && (
            <div className="space-y-6">
              {Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
                <div key={dateLabel}>
                  {/* Date Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-brand-600" />
                    <h4 className="font-bold text-brand-900">{dateLabel}</h4>
                    <div className="flex-1 h-px bg-brand-200"></div>
                  </div>

                  {/* Messages */}
                  <div className="space-y-3">
                    {msgs.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-4 bg-surface-raised rounded-[6px] border-2 border-border-subtle hover:border-brand-300 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <MessageSquare className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            {/* Time and Feedback */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs text-ink-muted font-medium">
                                {formatTime(msg.createdAt)}
                              </span>
                              {msg.wasHelpful !== null && (
                                <span
                                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                    msg.wasHelpful
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {msg.wasHelpful ? (
                                    <>
                                      <ThumbsUp className="w-3 h-3" />
                                      Útil
                                    </>
                                  ) : (
                                    <>
                                      <ThumbsDown className="w-3 h-3" />
                                      Não útil
                                    </>
                                  )}
                                </span>
                              )}
                            </div>

                            {/* Question */}
                            <p className="text-ink-primary font-medium mb-2">
                              {msg.question}
                            </p>

                            {/* Answer Preview (collapsible) */}
                            {msg.answer && (
                              <div className="mt-3">
                                {expandedMessageId === msg.id ? (
                                  <div className="p-3 bg-white rounded border border-brand-200">
                                    <p className="text-sm text-ink-secondary whitespace-pre-wrap">
                                      {msg.answer}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-ink-muted line-clamp-2">
                                    {msg.answer.substring(0, 150)}...
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 mt-3">
                              <button
                                onClick={() => toggleExpand(msg.id)}
                                className="text-xs text-brand-700 hover:text-brand-800 font-medium underline"
                              >
                                {expandedMessageId === msg.id
                                  ? 'Ocultar resposta'
                                  : 'Ver resposta completa'}
                              </button>
                              <span className="text-ink-muted">|</span>
                              <button
                                onClick={() => handleRestore(msg)}
                                className="text-xs text-brand-700 hover:text-brand-800 font-medium underline"
                              >
                                Restaurar esta conversa
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle bg-surface-raised">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-muted">
              {messages.length > 0 ? (
                <>
                  {messages.length} {messages.length === 1 ? 'pergunta' : 'perguntas'}{' '}
                  encontrada{messages.length !== 1 ? 's' : ''}
                </>
              ) : (
                'Nenhuma pergunta no histórico'
              )}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-brand-600 text-white rounded-[6px] hover:bg-brand-700 transition-colors font-medium text-sm"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
