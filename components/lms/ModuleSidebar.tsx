'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, BookOpen, CheckCircle, Play, Lock } from 'lucide-react';
import LessonProgressBar from './LessonProgressBar';

interface LessonItem {
  id: string;
  title: string;
  slug: string;
  estimatedMinutes?: number | null;
  requiresQuizPass?: boolean;
  hasQuiz?: boolean;
  quizPassed?: boolean;
  progress: { status: string; completedAt?: string | null } | null;
}

interface ModuleItem {
  id: string;
  title: string;
  description?: string | null;
  displayOrder: number;
  lessons: LessonItem[];
}

interface ModuleSidebarProps {
  modules: ModuleItem[];
  currentLessonId: string;
  courseSlug: string;
  courseTitle: string;
}

export default function ModuleSidebar({
  modules,
  currentLessonId,
  courseSlug,
  courseTitle,
}: ModuleSidebarProps) {
  // Expand the module containing the current lesson by default
  const currentModuleId = modules.find((m) =>
    m.lessons.some((l) => l.id === currentLessonId)
  )?.id;

  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(currentModuleId ? [currentModuleId] : [])
  );

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessons = modules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.progress?.status === 'completed').length,
    0
  );

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-brand-600 flex-shrink-0" />
          <h2 className="text-sm font-bold text-gray-900 line-clamp-1">{courseTitle}</h2>
        </div>
      </div>

      {/* Modules */}
      <div className="flex-1 overflow-y-auto">
        {modules.map((mod) => {
          const isExpanded = expandedModules.has(mod.id);
          const completedInModule = mod.lessons.filter(
            (l) => l.progress?.status === 'completed'
          ).length;

          return (
            <div key={mod.id} className="border-b border-gray-50 last:border-0">
              {/* Module header */}
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 line-clamp-1">{mod.title}</p>
                  <p className="text-[10px] text-gray-400">
                    {completedInModule}/{mod.lessons.length} {mod.lessons.length === 1 ? 'aula' : 'aulas'}
                  </p>
                </div>
              </button>

              {/* Lessons */}
              {isExpanded && (
                <div className="pb-2">
                  {mod.lessons.map((lesson, lessonIdx) => {
                    const isCurrent = lesson.id === currentLessonId;
                    const isCompleted = lesson.progress?.status === 'completed';

                    // Check if locked: requiresQuizPass and previous lesson quiz not passed
                    let isLocked = false;
                    if (lesson.requiresQuizPass && lessonIdx > 0) {
                      const prevLesson = mod.lessons[lessonIdx - 1];
                      if (prevLesson?.hasQuiz && !prevLesson.quizPassed) {
                        isLocked = true;
                      }
                    }

                    if (isLocked) {
                      return (
                        <div
                          key={lesson.id}
                          className="flex items-center gap-2.5 px-4 py-2 mx-2 rounded-lg opacity-50 cursor-not-allowed"
                          title="Complete o questionario da aula anterior para desbloquear"
                        >
                          <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-xs leading-snug line-clamp-2 text-gray-400">
                            {lesson.title}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={lesson.id}
                        href={`/area-restrita/curso/${courseSlug}/aula/${lesson.slug}`}
                        className={`flex items-center gap-2.5 px-4 py-2 mx-2 rounded-lg text-left transition-colors ${
                          isCurrent
                            ? 'bg-brand-50 border border-brand-200'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Status icon */}
                        <div className="flex-shrink-0">
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : isCurrent ? (
                            <Play className="w-4 h-4 text-brand-600" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                          )}
                        </div>

                        {/* Lesson title */}
                        <span
                          className={`text-xs leading-snug line-clamp-2 ${
                            isCurrent
                              ? 'font-bold text-brand-700'
                              : isCompleted
                                ? 'text-gray-500'
                                : 'text-gray-700'
                          }`}
                        >
                          {lesson.title}
                        </span>

                        {/* Quiz badge */}
                        {lesson.hasQuiz && (
                          <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            lesson.quizPassed
                              ? 'bg-green-100 text-green-600'
                              : 'bg-purple-100 text-purple-600'
                          }`}>
                            Q
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="border-t border-gray-100">
        <LessonProgressBar totalLessons={totalLessons} completedLessons={completedLessons} />
      </div>
    </div>
  );
}
