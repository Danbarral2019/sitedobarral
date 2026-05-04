'use client';

import { use, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  Clock,
  ChevronRight,
  Play,
  Lock,
} from 'lucide-react';
import { getIdFromSlug, getCourseBySlug } from '@/lib/courses';
import LessonProgressBar from '@/components/lms/LessonProgressBar';
import CourseSuspensionBanner from '@/components/lms/CourseSuspensionBanner';

interface LessonInfo {
  id: string;
  title: string;
  slug: string;
  estimatedMinutes?: number | null;
  displayOrder: number;
  prerequisiteId?: string | null;
  requiresQuizPass?: boolean;
  hasQuiz?: boolean;
  quizPassed?: boolean;
  progress: { status: string; completedAt?: string | null } | null;
}

interface ModuleInfo {
  id: string;
  title: string;
  description?: string | null;
  displayOrder: number;
  lessons: LessonInfo[];
}

interface CourseStatusInfo {
  isSuspended: boolean;
  suspensionReason?: string | null;
  suspendedAt?: string | null;
  plannedReturn?: string | null;
}

export default function CourseLandingPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = use(params);
  const router = useRouter();

  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [courseStatus, setCourseStatus] = useState<CourseStatusInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const courseId = useMemo(() => getIdFromSlug(courseSlug), [courseSlug]);
  const course = useMemo(() => getCourseBySlug(courseSlug), [courseSlug]);

  useEffect(() => {
    if (!courseId) {
      setError('Curso nao encontrado.');
      setIsLoading(false);
      return;
    }

    const fetchModules = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/area-restrita/courses/${courseId}/modules`);
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return;
          }
          if (res.status === 403) {
            setError('Voce nao esta matriculado neste curso.');
            setIsLoading(false);
            return;
          }
          throw new Error('Erro ao carregar modulos.');
        }

        const data = await res.json();
        setModules(data.modules || []);
        setCourseStatus(data.status || null);
      } catch (err) {
        console.error('Error loading course modules:', err);
        setError('Erro ao carregar o curso. Tente novamente.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchModules();
  }, [courseId, router]);

  const { totalLessons, completedLessons, allLessons } = useMemo(() => {
    const all: (LessonInfo & { moduleTitle: string })[] = [];
    for (const mod of modules) {
      for (const lesson of mod.lessons) {
        all.push({ ...lesson, moduleTitle: mod.title });
      }
    }
    const total = all.length;
    const completed = all.filter((l) => l.progress?.status === 'completed').length;
    return { totalLessons: total, completedLessons: completed, allLessons: all };
  }, [modules]);

  const continueLesson = useMemo(() => {
    if (allLessons.length === 0) return null;

    // Find first in_progress lesson
    const inProgress = allLessons.find((l) => l.progress?.status === 'in_progress');
    if (inProgress) return inProgress;

    // Find first not_started lesson (or one without progress)
    const notStarted = allLessons.find(
      (l) => !l.progress || l.progress.status === 'not_started'
    );
    if (notStarted) return notStarted;

    // All completed — return first lesson
    return allLessons[0];
  }, [allLessons]);

  const hasStarted = allLessons.some(
    (l) => l.progress?.status === 'in_progress' || l.progress?.status === 'completed'
  );

  // Loading
  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Carregando curso...</p>
        </div>
      </main>
    );
  }

  // Error
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <p className="text-gray-700 font-medium mb-4">{error}</p>
          <Link
            href="/area-restrita"
            className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 font-semibold text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Area Restrita
          </Link>
        </div>
      </main>
    );
  }

  const courseTitle = course?.title?.split('(')[0].trim() || 'Curso';
  const courseDescription = course?.shortDescription || '';

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/area-restrita"
            className="p-2 rounded-lg text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Curso</p>
            <h1 className="text-base lg:text-lg font-bold text-gray-900 truncate">
              {courseTitle}
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 lg:py-8">
        {courseStatus?.isSuspended && (
          <CourseSuspensionBanner
            reason={courseStatus.suspensionReason}
            suspendedAt={courseStatus.suspendedAt}
            plannedReturn={courseStatus.plannedReturn}
            variant="course"
          />
        )}

        {/* Course Info Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl shadow-md flex-shrink-0">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900 leading-tight">
                {courseTitle}
              </h2>
              {courseDescription && (
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                  {courseDescription}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3">
                <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">
                  {modules.length} {modules.length === 1 ? 'modulo' : 'modulos'}
                </span>
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  {totalLessons} {totalLessons === 1 ? 'aula' : 'aulas'}
                </span>
                {allLessons.some((l) => l.estimatedMinutes) && (
                  <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    {allLessons.reduce((sum, l) => sum + (l.estimatedMinutes || 0), 0)} min total
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {totalLessons > 0 && (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <LessonProgressBar
                totalLessons={totalLessons}
                completedLessons={completedLessons}
              />

              {/* Milestone badges */}
              {(() => {
                const pct = Math.round((completedLessons / totalLessons) * 100);
                const milestones = [
                  { threshold: 25, label: '25%', emoji: '\u{1F31F}' },
                  { threshold: 50, label: '50%', emoji: '\u{1F525}' },
                  { threshold: 75, label: '75%', emoji: '\u26A1' },
                  { threshold: 100, label: '100%', emoji: '\u{1F3C6}' },
                ];
                const reached = milestones.filter(m => pct >= m.threshold);
                if (reached.length === 0) return null;
                return (
                  <div className="flex items-center gap-2 mt-3 px-4">
                    {reached.map(m => (
                      <span
                        key={m.threshold}
                        className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full animate-[scale-in_0.3s_ease-out]"
                      >
                        <span>{m.emoji}</span>
                        {m.label}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Continue / Start Button */}
          {continueLesson && (
            <div className="mt-5">
              <Link
                href={`/area-restrita/curso/${courseSlug}/aula/${continueLesson.slug}`}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors shadow-sm"
              >
                <Play className="w-4 h-4" />
                {hasStarted ? 'Continuar de onde parou' : 'Comecar curso'}
                <ChevronRight className="w-4 h-4" />
              </Link>
              {hasStarted && continueLesson && (
                <p className="text-xs text-gray-400 mt-2">
                  Proxima: {continueLesson.title}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modules List */}
        <div className="space-y-4">
          {modules.map((mod) => {
            const moduleLessons = mod.lessons;
            const moduleCompleted = moduleLessons.filter(
              (l) => l.progress?.status === 'completed'
            ).length;
            const moduleTotal = moduleLessons.length;
            const isModuleComplete = moduleCompleted === moduleTotal && moduleTotal > 0;

            return (
              <div
                key={mod.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
              >
                {/* Module Header */}
                <div className="px-5 py-4 lg:px-6 lg:py-5 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm lg:text-base font-bold text-gray-900 leading-tight">
                        {mod.title}
                      </h3>
                      {mod.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {mod.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      {isModuleComplete ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Concluido
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-gray-400">
                          {moduleCompleted}/{moduleTotal}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lessons List */}
                <div className="divide-y divide-gray-50">
                  {moduleLessons.map((lesson) => {
                    const isCompleted = lesson.progress?.status === 'completed';
                    const isInProgress = lesson.progress?.status === 'in_progress';
                    const isContinueTarget = continueLesson?.id === lesson.id;

                    // Check prerequisite lock
                    let isLocked = false;
                    if (lesson.prerequisiteId) {
                      const prereq = allLessons.find(l => l.id === lesson.prerequisiteId);
                      if (prereq) {
                        const prereqCompleted = prereq.progress?.status === 'completed';
                        if (!prereqCompleted) {
                          isLocked = true;
                        } else if (prereq.requiresQuizPass && prereq.hasQuiz && !prereq.quizPassed) {
                          isLocked = true;
                        }
                      }
                    }

                    if (isLocked) {
                      return (
                        <div
                          key={lesson.id}
                          className="flex items-center gap-3 px-5 py-3.5 lg:px-6 lg:py-4 opacity-50 cursor-not-allowed"
                          title="Complete a aula pre-requisito para desbloquear"
                        >
                          <Lock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-tight text-gray-400">
                              {lesson.title}
                            </p>
                            {lesson.estimatedMinutes && (
                              <span className="flex items-center gap-1 text-xs text-gray-300 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {lesson.estimatedMinutes} min
                              </span>
                            )}
                          </div>
                          <Lock className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={lesson.id}
                        href={`/area-restrita/curso/${courseSlug}/aula/${lesson.slug}`}
                        className={`flex items-center gap-3 px-5 py-3.5 lg:px-6 lg:py-4 hover:bg-gray-50 transition-colors group ${
                          isContinueTarget ? 'bg-brand-50/30' : ''
                        }`}
                      >
                        {/* Status Icon */}
                        <div className="flex-shrink-0">
                          {isCompleted ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : isInProgress || isContinueTarget ? (
                            <Play className="w-5 h-5 text-brand-600" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                          )}
                        </div>

                        {/* Lesson Info */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium leading-tight ${
                              isCompleted
                                ? 'text-gray-500'
                                : isInProgress || isContinueTarget
                                ? 'text-brand-700 font-semibold'
                                : 'text-gray-800'
                            } group-hover:text-brand-600 transition-colors`}
                          >
                            {lesson.title}
                          </p>
                          {lesson.estimatedMinutes && (
                            <span className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {lesson.estimatedMinutes} min
                            </span>
                          )}
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 flex-shrink-0 transition-colors" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {modules.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              Este curso ainda nao possui modulos disponiveis.
            </p>
            <Link
              href="/area-restrita"
              className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 font-semibold text-sm mt-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para Area Restrita
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
