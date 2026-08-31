'use client';

import { CheckCircle, XCircle, Clock } from 'lucide-react';

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

interface QuizResultCardProps {
  attempt: PastAttempt;
  passingScore: number;
  index: number;
}

export default function QuizResultCard({ attempt, passingScore, index }: QuizResultCardProps) {
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const dateStr = new Date(attempt.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-[6px] border ${
      attempt.passed
        ? 'bg-green-50/50 border-green-100'
        : 'bg-surface-raised border-border-subtle'
    }`}>
      {attempt.passed ? (
        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink-secondary">
            Tentativa {index}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            attempt.passed
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {Math.round(attempt.score)}%
          </span>
          <span className="text-xs text-ink-muted">(min: {passingScore}%)</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-ink-muted">
          <span>{dateStr}</span>
          <span>{attempt.totalPoints}/{attempt.maxPoints} pts</span>
          {attempt.timeSpentSeconds != null && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {formatTime(attempt.timeSpentSeconds)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
