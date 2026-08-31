'use client';

interface LessonProgressBarProps {
  totalLessons: number;
  completedLessons: number;
}

const MILESTONES = [25, 50, 75, 100];

export default function LessonProgressBar({
  totalLessons,
  completedLessons,
}: LessonProgressBarProps) {
  const percentage = totalLessons > 0
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between text-xs text-ink-muted mb-1.5">
        <span className="font-medium">Progresso</span>
        <span className="font-semibold text-ink-secondary">{percentage}%</span>
      </div>
      <div className="relative w-full h-2 bg-surface-deep rounded-full overflow-visible">
        <div
          className="h-full bg-green-400 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
        {/* Milestone markers */}
        {MILESTONES.map(m => {
          if (m === 100) return null; // Skip 100% marker
          const reached = percentage >= m;
          return (
            <div
              key={m}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${m}%` }}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full border-2 -ml-[5px] transition-colors ${
                  reached
                    ? 'bg-green-500 border-green-600'
                    : 'bg-white border-border-subtle'
                }`}
                title={`${m}%`}
              />
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-ink-muted mt-1">
        {completedLessons}/{totalLessons} {totalLessons === 1 ? 'licao concluida' : 'licoes concluidas'}
      </p>
    </div>
  );
}
