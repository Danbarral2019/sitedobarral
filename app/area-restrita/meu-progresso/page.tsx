'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  TrendingUp,
  Flame,
  Trophy,
  Clock,
  BookOpen,
  Award,
  ArrowLeft,
  Zap,
  Target,
  CheckCircle2,
} from 'lucide-react';

interface CourseProgress {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  totalLessons: number;
  completedLessons: number;
  totalQuizzes: number;
  passedQuizzes: number;
  progressPercent: number;
  quizPercent: number;
  currentStreak: number;
  longestStreak: number;
  totalXp: number;
}

interface BadgeData {
  id: string;
  type: string;
  label: string;
  icon: string;
  description: string;
  courseId: string | null;
  awardedAt: string;
}

interface CertificateData {
  id: string;
  courseId: string;
  certificateNumber: string;
  courseTitle: string;
  issuedAt: string;
}

interface ActivityData {
  lessonTitle: string;
  courseId: string;
  status: string;
  lastAccessedAt: string | null;
}

interface ProgressData {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  totalStudyTimeSeconds: number;
  courseProgress: CourseProgress[];
  badges: BadgeData[];
  certificates: CertificateData[];
  recentActivity: ActivityData[];
}

function formatStudyTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}min`;
  return `${hours}h ${minutes}min`;
}

export default function MeuProgressoPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [data, setData] = useState<ProgressData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    const loadProgress = async () => {
      try {
        const response = await fetch('/api/area-restrita/progress');
        if (!response.ok) throw new Error('Erro ao carregar dados');
        const json = await response.json();
        setData(json);
      } catch (err) {
        console.error('Erro ao carregar progresso:', err);
        setError('Erro ao carregar dados de progresso.');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadProgress();
  }, [user]);

  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando progresso...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/area-restrita')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Voltar para area restrita
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.courseProgress.length === 0) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push('/area-restrita')}
            className="flex items-center gap-2 text-gray-700 hover:text-blue-600 mb-6 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para area restrita
          </button>

          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border-2 border-gray-200">
            <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Nenhum progresso ainda</h2>
            <p className="text-gray-600 mb-6">
              Comece um curso para ver seu progresso aqui!
            </p>
            <button
              onClick={() => router.push('/area-restrita')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
            >
              Explorar Cursos
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/area-restrita')}
            className="flex items-center gap-2 text-gray-700 hover:text-blue-600 mb-6 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para area restrita
          </button>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meu Progresso</h1>
              <p className="text-gray-600">Acompanhe sua evolucao nos cursos</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-md border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-yellow-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">XP Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{data.totalXp.toLocaleString('pt-BR')}</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-md border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Streak Atual</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {data.currentStreak} {data.currentStreak === 1 ? 'dia' : 'dias'}
            </p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-md border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Trophy className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Maior Streak</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {data.longestStreak} {data.longestStreak === 1 ? 'dia' : 'dias'}
            </p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-md border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Tempo de Estudo</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatStudyTime(data.totalStudyTimeSeconds)}</p>
          </div>
        </div>

        {/* Progresso por Curso */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Progresso por Curso
          </h2>
          <div className="space-y-4">
            {data.courseProgress.map((cp) => (
              <div
                key={cp.courseId}
                className="bg-white rounded-xl p-6 shadow-md border border-gray-100"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{cp.courseTitle}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>{cp.completedLessons}/{cp.totalLessons} aulas</span>
                      {cp.totalQuizzes > 0 && (
                        <span>{cp.passedQuizzes}/{cp.totalQuizzes} quizzes</span>
                      )}
                      <span>{cp.totalXp} XP</span>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">{cp.progressPercent}%</span>
                </div>

                {/* Barra de progresso das aulas */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Aulas concluidas</span>
                    <span>{cp.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${cp.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Barra de progresso dos quizzes */}
                {cp.totalQuizzes > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Quizzes aprovados</span>
                      <span>{cp.quizPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${cp.quizPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Badges e Atividades Recentes */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Badges */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-600" />
              Badges Conquistados ({data.badges.length})
            </h2>
            {data.badges.length === 0 ? (
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 text-center">
                <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Complete aulas e quizzes para ganhar badges!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="bg-white rounded-xl p-4 shadow-md border border-gray-100 flex items-center gap-4"
                  >
                    <span className="text-3xl">{badge.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{badge.label}</p>
                      <p className="text-sm text-gray-500">{badge.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(badge.awardedAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Atividades Recentes */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-green-600" />
              Atividades Recentes
            </h2>
            {data.recentActivity.length === 0 ? (
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 text-center">
                <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Nenhuma atividade recente.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentActivity.map((activity, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl p-4 shadow-md border border-gray-100 flex items-center gap-4"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      activity.status === 'completed'
                        ? 'bg-green-100'
                        : 'bg-blue-100'
                    }`}>
                      {activity.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <BookOpen className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{activity.lessonTitle}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span className={`px-2 py-0.5 rounded-full ${
                          activity.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {activity.status === 'completed' ? 'Concluida' : 'Em andamento'}
                        </span>
                        {activity.lastAccessedAt && (
                          <span>
                            {new Date(activity.lastAccessedAt).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Certificados */}
            {data.certificates.length > 0 && (
              <div className="mt-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  Certificados ({data.certificates.length})
                </h2>
                <div className="space-y-3">
                  {data.certificates.map((cert) => (
                    <div
                      key={cert.id}
                      className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-4 shadow-md border border-emerald-200 flex items-center gap-4"
                    >
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Award className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{cert.courseTitle}</p>
                        <p className="text-sm text-emerald-700 font-mono">{cert.certificateNumber}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Emitido em {new Date(cert.issuedAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
