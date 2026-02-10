'use client';

import { useState, useEffect } from 'react';
import { Flame, Trophy, Award, ChevronRight, Loader2 } from 'lucide-react';
import { BADGE_TYPES } from '@/lib/gamification';
import LeaderboardModal from './LeaderboardModal';

interface GamificationData {
  badges: Array<{
    id: string;
    type: string;
    label: string;
    icon: string;
    description: string;
    awardedAt: string;
  }>;
  streak: {
    current: number;
    longest: number;
    lastActivityDate: string | null;
  };
  xp: number;
  showOnLeaderboard: boolean;
  leaderboardPosition: number | null;
}

interface GamificationSidebarProps {
  courseId: string;
}

const XP_MILESTONES = [100, 250, 500, 1000, 2500, 5000];

function getNextMilestone(xp: number): number {
  for (const m of XP_MILESTONES) {
    if (xp < m) return m;
  }
  return XP_MILESTONES[XP_MILESTONES.length - 1] + 1000;
}

export default function GamificationSidebar({ courseId }: GamificationSidebarProps) {
  const [data, setData] = useState<GamificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    fetch(`/api/area-restrita/courses/${courseId}/gamification`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [courseId]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const nextMilestone = getNextMilestone(data.xp);
  const xpProgress = Math.min((data.xp / nextMilestone) * 100, 100);
  const allBadgeTypes = Object.values(BADGE_TYPES);

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Trophy className="w-4 h-4" />
            Sua Jornada
          </h3>
        </div>

        <div className="p-4 space-y-4">
          {/* XP Bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-purple-700">{data.xp} XP</span>
              <span className="text-gray-400">Meta: {nextMilestone} XP</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>

          {/* Streak */}
          <div className="flex items-center gap-3 bg-orange-50 rounded-xl px-3 py-2.5">
            <Flame className={`w-6 h-6 ${data.streak.current > 0 ? 'text-orange-500' : 'text-gray-300'}`} />
            <div>
              <p className="text-sm font-bold text-gray-900">
                {data.streak.current} {data.streak.current === 1 ? 'dia' : 'dias'} seguidos
              </p>
              <p className="text-[10px] text-gray-500">
                Recorde: {data.streak.longest} dias
              </p>
            </div>
          </div>

          {/* Badges */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">
              Badges ({data.badges.length}/{allBadgeTypes.length})
            </p>
            <div className="grid grid-cols-4 gap-2">
              {allBadgeTypes.map(bt => {
                const earned = data.badges.find(b => b.type === bt.type);
                return (
                  <div
                    key={bt.type}
                    className={`flex items-center justify-center w-9 h-9 rounded-lg text-lg ${
                      earned
                        ? 'bg-amber-50 border border-amber-200'
                        : 'bg-gray-50 border border-gray-100 opacity-30 grayscale'
                    }`}
                    title={earned ? `${bt.label} - ${bt.description}` : `${bt.label} (bloqueado)`}
                  >
                    {bt.icon}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leaderboard position */}
          <button
            onClick={() => setShowLeaderboard(true)}
            className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2.5 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium text-gray-700">Ranking</span>
            </div>
            <div className="flex items-center gap-1">
              {data.leaderboardPosition && (
                <span className="text-sm font-bold text-indigo-600">
                  #{data.leaderboardPosition}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
            </div>
          </button>
        </div>
      </div>

      {showLeaderboard && (
        <LeaderboardModal
          courseId={courseId}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
    </>
  );
}
