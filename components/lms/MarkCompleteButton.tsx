'use client';

import { useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';

interface MarkCompleteButtonProps {
  lessonId: string;
  currentStatus: string | null;
  onComplete: (newStatus: string) => void;
}

export default function MarkCompleteButton({
  lessonId,
  currentStatus,
  onComplete,
}: MarkCompleteButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (currentStatus === 'completed') {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-[6px] font-semibold text-sm border border-green-200">
        <CheckCircle className="w-5 h-5" />
        Concluida
      </div>
    );
  }

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/area-restrita/lessons/${lessonId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (res.ok) {
        onComplete('completed');
      }
    } catch (error) {
      console.error('Error marking lesson complete:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="flex items-center gap-2 px-4 py-2.5 border-2 border-green-500 text-green-700 rounded-[6px] font-semibold text-sm hover:bg-green-50 transition-colors disabled:opacity-50"
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <CheckCircle className="w-5 h-5" />
      )}
      Marcar como Concluida
    </button>
  );
}
