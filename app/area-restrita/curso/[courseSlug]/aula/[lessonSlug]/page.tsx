'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Menu,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { getIdFromSlug, getCourseBySlug } from '@/lib/courses';
import dynamic from 'next/dynamic';
import ModuleSidebar from '@/components/lms/ModuleSidebar';
import LessonContent from '@/components/lms/LessonContent';
import LessonDocuments from '@/components/lms/LessonDocuments';
import LessonVideos from '@/components/lms/LessonVideos';
import MarkCompleteButton from '@/components/lms/MarkCompleteButton';

const LessonAIAssistant = dynamic(() => import('@/components/lms/LessonAIAssistant'), {
  loading: () => <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>,
});

const QuizPlayer = dynamic(() => import('@/components/lms/QuizPlayer'), {
  loading: () => <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>,
});

const GamificationSidebar = dynamic(() => import('@/components/lms/GamificationSidebar'), {
  loading: () => <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>,
});

const LessonDiscussion = dynamic(() => import('@/components/lms/LessonDiscussion'), {
  loading: () => <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>,
});

interface LessonData {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  content?: string | null;
  estimatedMinutes?: number | null;
  aiSummary?: string | null;
  aiKeyPoints?: string[] | null;
  leiArticles?: number[] | null;
  module: {
    id: string;
    title: string;
    courseId: string;
  };
  documents: Array<{
    id: string;
    displayOrder: number;
    isRequired: boolean;
    note?: string | null;
    document: {
      id: string;
      title: string;
      description?: string | null;
      type: string;
      url?: string | null;
      category: string;
    };
  }>;
  videos: Array<{
    id: string;
    title: string;
    youtubeUrl: string;
    youtubeId: string;
    description?: string | null;
    displayOrder: number;
    isRequired: boolean;
  }>;
}

interface ProgressData {
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  lastAccessedAt?: string | null;
  timeSpentSeconds: number;
  contentRead: boolean;
  videosWatched: string[];
  documentsViewed: string[];
}

interface NavigationData {
  prev: { id: string; title: string; slug: string; moduleTitle: string } | null;
  next: { id: string; title: string; slug: string; moduleTitle: string } | null;
}

interface ModuleData {
  id: string;
  title: string;
  description?: string | null;
  displayOrder: number;
  lessons: Array<{
    id: string;
    title: string;
    slug: string;
    estimatedMinutes?: number | null;
    displayOrder: number;
    progress: { status: string; completedAt?: string | null } | null;
  }>;
}

export default function LessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}) {
  const { courseSlug, lessonSlug } = use(params);
  const router = useRouter();

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [navigation, setNavigation] = useState<NavigationData | null>(null);
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const courseId = useMemo(() => getIdFromSlug(courseSlug), [courseSlug]);
  const course = useMemo(() => getCourseBySlug(courseSlug), [courseSlug]);

  useEffect(() => {
    if (!courseId) {
      setError('Curso nao encontrado.');
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch modules first to find lessonId from slug
        const modulesRes = await fetch(`/api/area-restrita/courses/${courseId}/modules`);
        if (!modulesRes.ok) {
          if (modulesRes.status === 401) {
            router.push('/login');
            return;
          }
          if (modulesRes.status === 403) {
            setError('Voce nao esta matriculado neste curso.');
            setIsLoading(false);
            return;
          }
          throw new Error('Erro ao carregar modulos.');
        }

        const modulesData = await modulesRes.json();
        setModules(modulesData.modules || []);

        // Find lessonId by matching slug across all modules
        let lessonId: string | null = null;
        for (const mod of modulesData.modules) {
          const found = mod.lessons.find(
            (l: { slug: string }) => l.slug === lessonSlug
          );
          if (found) {
            lessonId = found.id;
            break;
          }
        }

        if (!lessonId) {
          setError('Aula nao encontrada.');
          setIsLoading(false);
          return;
        }

        // Fetch lesson detail
        const lessonRes = await fetch(`/api/area-restrita/lessons/${lessonId}`);
        if (!lessonRes.ok) {
          throw new Error('Erro ao carregar aula.');
        }

        const lessonData = await lessonRes.json();
        setLesson(lessonData.lesson);
        setProgress(lessonData.progress);
        setNavigation(lessonData.navigation);

        // Check if admin
        fetch('/api/auth/verify')
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.user?.role === 'admin') setIsAdmin(true); })
          .catch(() => {});

        // Mark as in_progress if not started
        if (!lessonData.progress || lessonData.progress.status === 'not_started') {
          fetch(`/api/area-restrita/lessons/${lessonId}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'in_progress' }),
          }).catch(() => {});
        }
      } catch (err) {
        console.error('Error loading lesson:', err);
        setError('Erro ao carregar a aula. Tente novamente.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [courseId, lessonSlug, router]);

  const handleMarkComplete = (newStatus: string) => {
    setProgress((prev) =>
      prev
        ? { ...prev, status: newStatus, completedAt: new Date().toISOString() }
        : { status: newStatus, completedAt: new Date().toISOString(), startedAt: null, lastAccessedAt: null, timeSpentSeconds: 0, contentRead: false, videosWatched: [], documentsViewed: [] }
    );
    // Update modules state so sidebar reflects the change
    setModules((prev) =>
      prev.map((mod) => ({
        ...mod,
        lessons: mod.lessons.map((l) =>
          l.id === lesson?.id
            ? { ...l, progress: { status: newStatus, completedAt: new Date().toISOString() } }
            : l
        ),
      }))
    );
  };

  // Loading
  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Carregando aula...</p>
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

  if (!lesson) return null;

  const handleNavigateNext = async (nextSlug: string) => {
    // Auto-complete current lesson if not already completed
    if (lesson && progress?.status !== 'completed') {
      try {
        await fetch(`/api/area-restrita/lessons/${lesson.id}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        });
        handleMarkComplete('completed');
      } catch {
        // Navigate anyway even if marking fails
      }
    }
    router.push(`/area-restrita/curso/${courseSlug}/aula/${nextSlug}`);
  };

  const courseTitle = course?.title || 'Curso';

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/area-restrita"
              className="p-2 rounded-lg text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="hidden sm:block min-w-0">
              <p className="text-xs text-gray-400 truncate">{course?.title.split('(')[0].trim()}</p>
              <p className="text-sm font-bold text-gray-900 truncate">{lesson.title}</p>
            </div>
            <p className="sm:hidden text-sm font-bold text-gray-900 truncate max-w-[200px]">
              {lesson.title}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lesson.estimatedMinutes && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                {lesson.estimatedMinutes} min
              </span>
            )}
            <MarkCompleteButton
              lessonId={lesson.id}
              currentStatus={progress?.status || null}
              onComplete={handleMarkComplete}
            />
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-[280px] flex-shrink-0 p-4 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
          <ModuleSidebar
            modules={modules}
            currentLessonId={lesson.id}
            courseSlug={courseSlug}
            courseTitle={courseTitle.split('(')[0].trim()}
          />
          <div className="mt-4">
            <GamificationSidebar courseId={lesson.module.courseId} />
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[300px] bg-white shadow-xl overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="font-bold text-sm text-gray-900">Navegacao</h3>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div onClick={() => setSidebarOpen(false)}>
                <ModuleSidebar
                  modules={modules}
                  currentLessonId={lesson.id}
                  courseSlug={courseSlug}
                  courseTitle={courseTitle.split('(')[0].trim()}
                />
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0 px-4 py-6 lg:py-8 max-w-4xl">
          {/* Lesson Header */}
          <div className="mb-8">
            <p className="text-xs text-brand-600 font-semibold mb-1">
              {lesson.module.title}
            </p>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">
              {lesson.title}
            </h1>
            {lesson.description && (
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">{lesson.description}</p>
            )}
            {lesson.estimatedMinutes && (
              <div className="flex items-center gap-1.5 mt-3">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-400">
                  Tempo estimado: {lesson.estimatedMinutes} minutos
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          {lesson.content && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8 mb-6">
              <LessonContent
                content={lesson.content}
                aiSummary={lesson.aiSummary}
                aiKeyPoints={lesson.aiKeyPoints}
              />
            </div>
          )}

          {/* Videos */}
          {lesson.videos.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
              <LessonVideos videos={lesson.videos} />
            </div>
          )}

          {/* Documents */}
          {lesson.documents.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
              <LessonDocuments documents={lesson.documents} />
            </div>
          )}

          {/* Quiz */}
          <div className="mb-6">
            <QuizPlayer lessonId={lesson.id} />
          </div>

          {/* AI Assistant */}
          <div className="mb-6">
            <LessonAIAssistant
              lessonTitle={lesson.title}
              courseId={lesson.module.courseId}
              leiArticles={lesson.leiArticles}
            />
          </div>

          {/* Discussion */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <LessonDiscussion lessonId={lesson.id} isAdmin={isAdmin} />
          </div>

          {/* Prev/Next Navigation */}
          {navigation && (navigation.prev || navigation.next) && (
            <div className="flex items-stretch gap-3 mt-8">
              {navigation.prev ? (
                <Link
                  href={`/area-restrita/curso/${courseSlug}/aula/${navigation.prev.slug}`}
                  className="flex-1 flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 hover:border-brand-300 hover:shadow-sm transition-all group"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-300 group-hover:text-brand-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Anterior</p>
                    <p className="text-sm font-semibold text-gray-700 line-clamp-1 group-hover:text-brand-600">
                      {navigation.prev.title}
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="flex-1" />
              )}
              {navigation.next ? (
                <button
                  onClick={() => handleNavigateNext(navigation.next!.slug)}
                  className="flex-1 flex items-center justify-end gap-3 bg-white border border-gray-200 rounded-2xl p-4 hover:border-brand-300 hover:shadow-sm transition-all group text-right cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Proxima</p>
                    <p className="text-sm font-semibold text-gray-700 line-clamp-1 group-hover:text-brand-600">
                      {navigation.next.title}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-brand-500 flex-shrink-0" />
                </button>
              ) : (
                <div className="flex-1" />
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
