'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Source {
  title: string;
  category: string;
  url?: string;
}

interface LessonAIAssistantProps {
  lessonTitle: string;
  courseId: string;
  leiArticles?: number[] | null;
  documentIds?: string[] | null;
}

export default function LessonAIAssistant({
  lessonTitle,
  courseId,
  leiArticles,
}: LessonAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const query = input.trim();
    if (!query || isLoading) return;

    const userMessage: Message = { role: 'user', content: query };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const articlesStr = leiArticles?.length
        ? leiArticles.map((a) => `Art. ${a}`).join(', ')
        : 'nenhum artigo especifico';

      const res = await fetch('/api/documents/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          maxResults: 5,
          courseId,
          context: `Contexto: O aluno esta estudando a licao '${lessonTitle}'. Artigos relacionados: ${articlesStr}`,
          conversationHistory: updatedMessages.slice(0, -1).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error('Erro na resposta da IA');
      }

      const data = await res.json();
      const aiContent = data.synthesizedAnswer || data.answer || 'Desculpe, nao consegui gerar uma resposta.';

      setMessages((prev) => [...prev, { role: 'assistant', content: aiContent }]);

      if (data.results?.length) {
        setSources(
          data.results.slice(0, 5).map((r: { title: string; category: string; url?: string }) => ({
            title: r.title,
            category: r.category,
            url: r.url,
          }))
        );
      }
    } catch (error) {
      console.error('AI Assistant error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Ocorreu um erro ao processar sua pergunta. Tente novamente.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-50 to-brand-50 border border-purple-200 rounded-2xl text-purple-700 font-semibold text-sm hover:from-purple-100 hover:to-brand-100 transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        Perguntar a IA sobre esta aula
      </button>
    );
  }

  return (
    <div className="bg-white border border-purple-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(false)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-purple-50 to-brand-50 border-b border-purple-100"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className="font-semibold text-purple-900 text-sm">Assistente IA</span>
        </div>
        <ChevronUp className="w-4 h-4 text-purple-400" />
      </button>

      {/* Messages */}
      <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">
            Faca uma pergunta sobre o conteudo desta aula.
          </p>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-xl rounded-bl-sm">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <div className="px-4 pb-2">
          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Fontes</p>
          <div className="flex flex-wrap gap-1.5">
            {sources.map((src, idx) => (
              <a
                key={idx}
                href={src.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full hover:bg-brand-100 transition-colors"
              >
                {src.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Sua pergunta..."
            className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-3 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
