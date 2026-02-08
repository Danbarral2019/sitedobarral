'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  History,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  Scale,
  AlertCircle,
  Loader2,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface QuestionData {
  id: string;
  articleNumber: string;
  question: string;
  answer: string | null;
  conversationId: string | null;
  wasHelpful: boolean | null;
  createdAt: string;
}

interface GroupedQuestions {
  today: QuestionData[];
  yesterday: QuestionData[];
  thisWeek: QuestionData[];
  thisMonth: QuestionData[];
  older: QuestionData[];
}

interface Stats {
  total: number;
  helpful: number;
  notHelpful: number;
  unanswered: number;
  uniqueArticles: number;
}

interface ApiResponse {
  success: boolean;
  data: {
    questions: GroupedQuestions;
    stats: Stats;
  };
}

const periodLabels: Record<keyof GroupedQuestions, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  thisWeek: 'Esta Semana',
  thisMonth: 'Este Mes',
  older: 'Anteriores',
};

export default function HistoricoIAPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse['data'] | null>(null);
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set(['today', 'yesterday']));
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    fetchHistory();
  }, [user, authLoading, router]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/chat/history');
      if (!response.ok) {
        throw new Error('Erro ao carregar historico');
      }

      const result: ApiResponse = await response.json();
      setData(result.data);
    } catch (err) {
      console.error('[Historico] Erro:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const togglePeriod = (period: string) => {
    setExpandedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(period)) {
        next.delete(period);
      } else {
        next.add(period);
      }
      return next;
    });
  };

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Deseja realmente excluir esta pergunta do historico?')) {
      return;
    }

    try {
      setDeletingId(questionId);
      const response = await fetch(`/api/chat/history?id=${questionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir');
      }

      // Recarregar historico
      await fetchHistory();
    } catch (err) {
      console.error('[Historico] Erro ao deletar:', err);
      alert('Erro ao excluir pergunta');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 60) {
      return `ha ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
      return `ha ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando historico...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-900 text-center mb-2">
            Erro ao Carregar
          </h2>
          <p className="text-red-700 text-center mb-4">{error}</p>
          <button
            onClick={() => fetchHistory()}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const totalQuestions = data?.stats.total || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          {/* Navegacao */}
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/area-restrita"
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Área Restrita</span>
            </Link>
          </div>

          {/* Titulo */}
          <div className="flex items-center gap-3">
            <History className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">Historico de Perguntas</h1>
              <p className="text-blue-100">
                {totalQuestions} pergunta{totalQuestions !== 1 ? 's' : ''} realizada{totalQuestions !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Stats */}
          {data?.stats && totalQuestions > 0 && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>{data.stats.uniqueArticles} artigos consultados</span>
              </div>
              {data.stats.helpful > 0 && (
                <div className="flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4" />
                  <span>{data.stats.helpful} respostas uteis</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {totalQuestions === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2">Nenhuma pergunta ainda</p>
            <p className="text-gray-500 text-sm mb-6">
              Acesse a Lei 14.133 Comentada e faca perguntas sobre os artigos para ver seu historico aqui.
            </p>
            <Link
              href="/area-restrita/lei-comentada"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Scale className="w-5 h-5" />
              Acessar Lei 14.133
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.questions && (Object.keys(periodLabels) as Array<keyof GroupedQuestions>).map((period) => {
              const questions = data.questions[period];
              if (questions.length === 0) return null;

              const isPeriodExpanded = expandedPeriods.has(period);

              return (
                <div key={period} className="bg-white rounded-lg shadow-md overflow-hidden">
                  {/* Header do Periodo */}
                  <button
                    onClick={() => togglePeriod(period)}
                    className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-gray-50 to-blue-50 hover:from-gray-100 hover:to-blue-100 transition-colors text-left"
                  >
                    {isPeriodExpanded ? (
                      <ChevronDown className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{periodLabels[period]}</h3>
                      <p className="text-xs text-gray-600">
                        {questions.length} pergunta{questions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-bold">
                      {questions.length}
                    </div>
                  </button>

                  {/* Lista de Perguntas */}
                  {isPeriodExpanded && (
                    <div className="border-t border-gray-200">
                      {questions.map((question) => {
                        const isQuestionExpanded = expandedQuestions.has(question.id);

                        return (
                          <div key={question.id} className="border-b border-gray-100 last:border-b-0">
                            <button
                              onClick={() => toggleQuestion(question.id)}
                              className="w-full flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                            >
                              {isQuestionExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Link
                                    href={`/area-restrita/lei-comentada?artigo=${question.articleNumber}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700"
                                  >
                                    Art. {question.articleNumber}
                                  </Link>
                                  <span className="text-xs text-gray-500">{formatDate(question.createdAt)}</span>
                                  {question.wasHelpful === true && (
                                    <ThumbsUp className="w-3 h-3 text-green-600" />
                                  )}
                                  {question.wasHelpful === false && (
                                    <ThumbsDown className="w-3 h-3 text-red-600" />
                                  )}
                                </div>
                                <p className="text-gray-800 text-sm line-clamp-2">{question.question}</p>
                              </div>
                            </button>

                            {/* Resposta Expandida */}
                            {isQuestionExpanded && question.answer && (
                              <div className="px-4 pb-4 ml-7">
                                <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-lg">
                                  <h4 className="font-bold text-gray-900 text-sm mb-2">Resposta da IA:</h4>
                                  <div className="text-gray-800 text-sm whitespace-pre-wrap">
                                    {question.answer}
                                  </div>

                                  {/* Acoes */}
                                  <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                                    <Link
                                      href={`/area-restrita/lei-comentada?artigo=${question.articleNumber}`}
                                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                      Ver no artigo
                                    </Link>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteQuestion(question.id);
                                      }}
                                      disabled={deletingId === question.id}
                                      className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                                    >
                                      {deletingId === question.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-4 h-4" />
                                      )}
                                      Excluir
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Sem resposta */}
                            {isQuestionExpanded && !question.answer && (
                              <div className="px-4 pb-4 ml-7">
                                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                  <p className="text-amber-800 text-sm">
                                    Esta pergunta ainda nao recebeu resposta da IA.
                                  </p>

                                  <div className="mt-3 flex items-center justify-between">
                                    <Link
                                      href={`/area-restrita/lei-comentada?artigo=${question.articleNumber}`}
                                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                      Ver artigo
                                    </Link>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteQuestion(question.id);
                                      }}
                                      disabled={deletingId === question.id}
                                      className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                                    >
                                      {deletingId === question.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-4 h-4" />
                                      )}
                                      Excluir
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
