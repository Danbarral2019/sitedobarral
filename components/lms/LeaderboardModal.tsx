'use client';

import { useState, useEffect } from 'react';
import { X, Trophy, Flame, Award, Loader2, Eye, EyeOff } from 'lucide-react';

interface LeaderboardEntry {
  position: number;
  userId: string;
  name: string;
  initial: string;
  xp: number;
  streak: number;
  badgeCount: number;
  isCurrentUser: boolean;
}

interface LeaderboardModalProps {
  courseId: string;
  onClose: () => void;
}

export default function LeaderboardModal({ courseId, onClose }: LeaderboardModalProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentUserPosition, setCurrentUserPosition] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    fetch(`/api/area-restrita/courses/${courseId}/leaderboard`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setLeaderboard(d.leaderboard || []);
          setCurrentUserPosition(d.currentUserPosition);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    // Get current opt-in status
    fetch(`/api/area-restrita/courses/${courseId}/gamification`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) setShowOnLeaderboard(d.showOnLeaderboard);
      })
      .catch(() => {});
  }, [courseId]);

  const toggleOptIn = async () => {
    if (isToggling) return;
    setIsToggling(true);
    const newValue = !showOnLeaderboard;
    setShowOnLeaderboard(newValue);

    try {
      const res = await fetch(`/api/area-restrita/courses/${courseId}/gamification/opt-in`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showOnLeaderboard: newValue }),
      });
      if (!res.ok) {
        setShowOnLeaderboard(!newValue); // rollback
      }
    } catch {
      setShowOnLeaderboard(!newValue);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Ranking
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-130px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Trophy className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Nenhum aluno no ranking ainda.</p>
              <p className="text-xs text-gray-400 mt-1">Complete aulas e quizzes para ganhar XP!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {leaderboard.map((entry) => (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 px-5 py-3 ${
                    entry.isCurrentUser ? 'bg-indigo-50' : ''
                  }`}
                >
                  {/* Position */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    entry.position === 1 ? 'bg-amber-100 text-amber-700' :
                    entry.position === 2 ? 'bg-gray-200 text-gray-700' :
                    entry.position === 3 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-50 text-gray-500'
                  }`}>
                    {entry.position <= 3 ? ['', '\u{1F947}', '\u{1F948}', '\u{1F949}'][entry.position] : entry.position}
                  </div>

                  {/* Avatar + Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{entry.initial}</span>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${entry.isCurrentUser ? 'text-indigo-700 font-semibold' : 'text-gray-900'}`}>
                          {entry.name}
                          {entry.isCurrentUser && <span className="text-xs text-indigo-500 ml-1">(voce)</span>}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {entry.streak > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Flame className="w-3 h-3 text-orange-400" />
                              {entry.streak}d
                            </span>
                          )}
                          {entry.badgeCount > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Award className="w-3 h-3 text-amber-400" />
                              {entry.badgeCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* XP */}
                  <span className="text-sm font-bold text-indigo-600 flex-shrink-0">
                    {entry.xp} XP
                  </span>
                </div>
              ))}

              {/* Show current user position if not in top 20 */}
              {currentUserPosition && currentUserPosition > 20 && (
                <div className="px-5 py-3 bg-indigo-50 text-center">
                  <p className="text-sm text-indigo-700">
                    Sua posicao: <span className="font-bold">#{currentUserPosition}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: opt-in toggle */}
        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {showOnLeaderboard ? 'Visivel no ranking' : 'Oculto do ranking'}
          </span>
          <button
            onClick={toggleOptIn}
            disabled={isToggling}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              showOnLeaderboard
                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {showOnLeaderboard ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {showOnLeaderboard ? 'Visivel' : 'Oculto'}
          </button>
        </div>
      </div>
    </div>
  );
}
