'use client';

interface LessonProgressBarProps {
  totalLessons: number;
  completedLessons: number;
}

export default function LessonProgressBar({
  totalLessons,
  completedLessons,
}: LessonProgressBarProps) {
  const percentage = totalLessons > 0
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
        <span className="font-medium">Progresso</span>
        <span className="font-semibold text-gray-700">{percentage}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-400 mt-1">
        {completedLessons}/{totalLessons} {totalLessons === 1 ? 'licao concluida' : 'licoes concluidas'}
      </p>
    </div>
  );
}
