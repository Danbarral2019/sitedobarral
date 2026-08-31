'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import QuizResultCard from './QuizResultCard';

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestion {
  id: string;
  type: string;
  text: string;
  options: QuizOption[];
  points: number;
}

interface QuizInfo {
  id: string;
  title: string;
  description?: string | null;
  passingScore: number;
  timeLimitMinutes?: number | null;
  maxAttempts?: number | null;
  questionCount: number;
  totalPoints: number;
}

interface AttemptResult {
  questionId: string;
  correct: boolean;
  correctOptionId: string;
  selectedOptionId: string;
  explanation: string | null;
  points: number;
}

interface PastAttempt {
  id: string;
  score: number;
  totalPoints: number;
  maxPoints: number;
  passed: boolean;
  startedAt: string;
  completedAt?: string | null;
  timeSpentSeconds?: number | null;
  createdAt: string;
}

interface QuizPlayerProps {
  lessonId: string;
  onQuizPass?: () => void;
}

export default function QuizPlayer({ lessonId, onQuizPass }: QuizPlayerProps) {
  const [quiz, setQuiz] = useState<QuizInfo | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [pastAttempts, setPastAttempts] = useState<PastAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quiz state
  const [isStarted, setIsStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<AttemptResult[] | null>(null);
  const [submittedScore, setSubmittedScore] = useState<{
    score: number;
    passed: boolean;
    totalPoints: number;
    maxPoints: number;
  } | null>(null);

  // Timer
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [startedAt] = useState<string>(new Date().toISOString());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const fetchQuiz = useCallback(async () => {
    setIsLoading(true);
    try {
      const [quizRes, attemptsRes] = await Promise.all([
        fetch(`/api/area-restrita/lessons/${lessonId}/quiz`),
        fetch(`/api/area-restrita/lessons/${lessonId}/quiz/attempts`),
      ]);

      if (quizRes.status === 404) {
        setQuiz(null);
        setIsLoading(false);
        return;
      }

      if (!quizRes.ok) throw new Error('Erro ao carregar quiz.');

      const quizData = await quizRes.json();
      setQuiz(quizData.quiz);
      setQuestions(quizData.questions);
      setAttemptsRemaining(quizData.attemptsRemaining);

      if (attemptsRes.ok) {
        const attData = await attemptsRes.json();
        setPastAttempts(attData.attempts || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar quiz.');
    } finally {
      setIsLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  // Ref to always have fresh handleSubmit (avoids stale closure in timer)
  const handleSubmitRef = useRef<(() => Promise<void>) | null>(null);

  // Timer countdown
  useEffect(() => {
    if (!isStarted || results) return;

    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);

      if (quiz?.timeLimitMinutes) {
        setTimeRemaining(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            // Auto-submit when time runs out (uses ref to avoid stale closure)
            handleSubmitRef.current?.();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isStarted, results, quiz?.timeLimitMinutes]);

  const handleStart = () => {
    setIsStarted(true);
    setAnswers({});
    setResults(null);
    setSubmittedScore(null);
    setElapsedSeconds(0);
    if (quiz?.timeLimitMinutes) {
      setTimeRemaining(quiz.timeLimitMinutes * 60);
    }
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    if (results) return; // Don't allow changes after submit
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    handleSubmitRef.current = handleSubmit;

    try {
      const answersArray = Object.entries(answers).map(([questionId, selectedOptionId]) => ({
        questionId,
        selectedOptionId,
      }));

      const res = await fetch(`/api/area-restrita/lessons/${lessonId}/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answersArray,
          startedAt,
          timeSpentSeconds: elapsedSeconds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao enviar respostas.');
      }

      const data = await res.json();
      setResults(data.results);
      setSubmittedScore({
        score: data.attempt.score,
        passed: data.attempt.passed,
        totalPoints: data.attempt.totalPoints,
        maxPoints: data.attempt.maxPoints,
      });

      if (data.attempt.passed && onQuizPass) {
        onQuizPass();
      }

      // Refresh attempts
      const attRes = await fetch(`/api/area-restrita/lessons/${lessonId}/quiz/attempts`);
      if (attRes.ok) {
        const attData = await attRes.json();
        setPastAttempts(attData.attempts || []);
        setAttemptsRemaining(
          quiz?.maxAttempts ? Math.max(0, quiz.maxAttempts - (attData.attempts?.length || 0)) : null
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar respostas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keep ref updated every render so timer always calls latest version
  handleSubmitRef.current = handleSubmit;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-ink-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Carregando questionario...</span>
      </div>
    );
  }

  if (!quiz) return null;

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;
  const hasPassed = pastAttempts.some(a => a.passed);
  const canRetry = attemptsRemaining === null || attemptsRemaining > 0;

  // ── PRE-START / RESULT SUMMARY ──
  if (!isStarted || results) {
    return (
      <div className="bg-white rounded-[6px] border border-border-subtle p-6">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck className="w-5 h-5 text-brand-600" />
          <h3 className="text-lg font-bold text-ink-primary">{quiz.title}</h3>
        </div>

        {/* Result summary if just submitted */}
        {submittedScore && results && (
          <div className={`rounded-[6px] p-5 mb-6 ${
            submittedScore.passed
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              {submittedScore.passed ? (
                <Trophy className="w-6 h-6 text-green-600" />
              ) : (
                <XCircle className="w-6 h-6 text-red-500" />
              )}
              <div>
                <p className={`font-bold text-lg ${submittedScore.passed ? 'text-green-700' : 'text-red-700'}`}>
                  {submittedScore.passed ? 'Aprovado!' : 'Nao aprovado'}
                </p>
                <p className="text-sm text-ink-muted">
                  Nota: {Math.round(submittedScore.score)}% (minimo: {quiz.passingScore}%)
                </p>
              </div>
            </div>
            <p className="text-sm text-ink-muted">
              {submittedScore.totalPoints}/{submittedScore.maxPoints} pontos  ·  Tempo: {formatTime(elapsedSeconds)}
            </p>

            {/* Show per-question results */}
            <div className="mt-4 space-y-3">
              {questions.map((q, idx) => {
                const result = results.find(r => r.questionId === q.id);
                return (
                  <div key={q.id} className="bg-white rounded-[6px] p-4 border border-border-subtle">
                    <div className="flex items-start gap-2 mb-2">
                      {result?.correct ? (
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      )}
                      <p className="text-sm font-medium text-ink-secondary">
                        {idx + 1}. {q.text}
                      </p>
                    </div>
                    {q.options.map(opt => {
                      const isSelected = result?.selectedOptionId === opt.id;
                      const isCorrect = result?.correctOptionId === opt.id;
                      return (
                        <div
                          key={opt.id}
                          className={`ml-6 px-3 py-1.5 rounded text-sm mb-1 ${
                            isCorrect
                              ? 'bg-green-50 text-green-700 font-medium'
                              : isSelected
                                ? 'bg-red-50 text-red-700'
                                : 'text-ink-muted'
                          }`}
                        >
                          {opt.text}
                          {isCorrect && ' ✓'}
                          {isSelected && !isCorrect && ' ✗'}
                        </div>
                      );
                    })}
                    {result?.explanation && (
                      <p className="ml-6 mt-2 text-xs text-ink-muted italic">
                        {result.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quiz info */}
        {!submittedScore && (
          <div className="space-y-3 mb-6">
            {quiz.description && (
              <p className="text-sm text-ink-muted">{quiz.description}</p>
            )}
            <div className="flex flex-wrap gap-3 text-sm text-ink-muted">
              <span className="flex items-center gap-1">
                <ClipboardCheck className="w-4 h-4" />
                {quiz.questionCount} {quiz.questionCount === 1 ? 'pergunta' : 'perguntas'}
              </span>
              <span>Nota minima: {quiz.passingScore}%</span>
              {quiz.timeLimitMinutes && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {quiz.timeLimitMinutes} min
                </span>
              )}
              {quiz.maxAttempts && (
                <span>Max {quiz.maxAttempts} tentativa{quiz.maxAttempts > 1 ? 's' : ''}</span>
              )}
            </div>
            {hasPassed && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-[6px] px-3 py-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Voce ja foi aprovado neste questionario</span>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {canRetry && (
            <button
              onClick={handleStart}
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-[6px] font-medium text-sm hover:bg-brand-700 transition-colors"
            >
              {submittedScore || pastAttempts.length > 0 ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Tentar Novamente
                </>
              ) : (
                'Iniciar Questionario'
              )}
            </button>
          )}
          {!canRetry && !hasPassed && (
            <div className="flex items-center gap-2 text-ink-primary bg-amber-accent-soft rounded-[6px] px-3 py-2 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Tentativas esgotadas
            </div>
          )}
        </div>

        {/* Past attempts */}
        {pastAttempts.length > 0 && !submittedScore && (
          <div className="mt-6 border-t border-border-subtle pt-4">
            <h4 className="text-sm font-bold text-ink-secondary mb-3">Tentativas anteriores</h4>
            <div className="space-y-2">
              {pastAttempts.map((attempt, idx) => (
                <QuizResultCard
                  key={attempt.id}
                  attempt={attempt}
                  passingScore={quiz.passingScore}
                  index={pastAttempts.length - idx}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── QUIZ IN PROGRESS ──
  return (
    <div className="bg-white rounded-[6px] border border-border-subtle p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-brand-600" />
          <h3 className="text-lg font-bold text-ink-primary">{quiz.title}</h3>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-muted">
            {answeredCount}/{questions.length}
          </span>
          {timeRemaining !== null && (
            <span className={`flex items-center gap-1 font-mono font-bold ${
              timeRemaining < 60 ? 'text-red-600' : 'text-ink-muted'
            }`}>
              <Clock className="w-4 h-4" />
              {formatTime(timeRemaining)}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-surface-deep rounded-full mb-6">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-300"
          style={{ width: `${(answeredCount / questions.length) * 100}%` }}
        />
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((question, idx) => (
          <div key={question.id} className="border border-border-subtle rounded-[6px] p-5">
            <p className="text-sm font-medium text-ink-secondary mb-3">
              <span className="text-brand-600 font-bold">{idx + 1}.</span>{' '}
              {question.text}
              {question.points > 1 && (
                <span className="text-xs text-ink-muted ml-2">({question.points} pts)</span>
              )}
            </p>
            <div className="space-y-2">
              {question.options.map(option => {
                const isSelected = answers[question.id] === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelectOption(question.id, option.id)}
                    className={`w-full text-left px-4 py-3 rounded-[6px] border text-sm transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                        : 'border-border-subtle hover:border-brand-300 hover:bg-brand-50/30 text-ink-secondary'
                    }`}
                  >
                    {option.text}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-ink-muted">
          {allAnswered ? 'Todas respondidas' : `Faltam ${questions.length - answeredCount}`}
        </p>
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || isSubmitting}
          className="inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-2.5 rounded-[6px] font-medium text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando...
            </>
          ) : (
            'Enviar Respostas'
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
