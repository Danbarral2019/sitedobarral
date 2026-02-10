'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { courses } from '@/data/courses';
import {
  BarChart3, Users, GraduationCap, Award, CheckCircle,
  Loader2, AlertCircle, ArrowLeft, Calendar, AlertTriangle,
  ChevronDown,
} from 'lucide-react';

interface GlobalData {
  summary: {
    activeStudents: number;
    completedLessons: number;
    totalCertificates: number;
    quizzesApproved: number;
  };
  activityChart: Array<{ date: string; count: number }>;
  inactiveStudents: Array<{
    userId: string;
    name: string;
    email: string;
    lastAccess: string | null;
    daysSince: number;
  }>;
  courseSummary: Array<{
    courseId: string;
    title: string;
    activeStudents: number;
  }>;
}

interface CourseData {
  courseId: string;
  funnel: {
    enrolled: number;
    started: number;
    completedAll: number;
    certified: number;
  };
  moduleProgress: Array<{
    moduleId: string;
    title: string;
    avgCompletion: number;
    totalLessons: number;
  }>;
  quizStats: Array<{
    lessonTitle: string;
    quizId: string;
    totalAttempts: number;
    passedAttempts: number;
    passRate: number;
    avgScore: number;
    uniqueUsers: number;
  }>;
  students: Array<{
    userId: string;
    name: string;
    email: string;
    completionPct: number;
    lastAccess: string | null;
    daysSinceAccess: number | null;
    status: 'active' | 'at_risk' | 'inactive';
    avgQuizScore: number | null;
  }>;
  activityChart: Array<{ date: string; count: number }>;
}

export default function LMSAnalyticsClient() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [globalData, setGlobalData] = useState<GlobalData | null>(null);
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [isLoadingCourse, setIsLoadingCourse] = useState(false);

  const verifyAndLoad = useCallback(async () => {
    try {
      const authRes = await fetch('/api/auth/verify');
      if (!authRes.ok) { router.push('/validar-acesso'); return; }
      const authData = await authRes.json();
      if (authData.user.role !== 'admin') { router.push('/area-restrita'); return; }

      const res = await fetch('/api/admin/lms/analytics');
      if (!res.ok) throw new Error('Erro ao carregar analytics');
      const data = await res.json();
      setGlobalData(data);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar analytics');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => { verifyAndLoad(); }, [verifyAndLoad]);

  const loadCourse = useCallback(async (courseId: string) => {
    if (!courseId) { setCourseData(null); return; }
    setIsLoadingCourse(true);
    try {
      const res = await fetch(`/api/admin/lms/analytics?courseId=${courseId}`);
      if (!res.ok) throw new Error('Erro');
      const data = await res.json();
      setCourseData(data);
    } catch {
      setCourseData(null);
    } finally {
      setIsLoadingCourse(false);
    }
  }, []);

  const handleCourseChange = (courseId: string) => {
    setSelectedCourse(courseId);
    loadCourse(courseId);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !globalData) {
    return (
      <AdminLayout>
        <div className="p-8">
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-red-900 mb-1">Erro</h3>
              <p className="text-red-700">{error || 'Erro desconhecido'}</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const { summary, activityChart, inactiveStudents, courseSummary } = globalData;

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <Link href="/admin/lms" className="hover:text-blue-600 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              LMS
            </Link>
            <span>/</span>
            <span className="text-gray-900">Analytics</span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics LMS</h1>
              <p className="text-gray-600">Metricas de uso e desempenho dos alunos</p>
            </div>
          </div>

          {/* Course selector */}
          <div className="relative inline-block">
            <select
              value={selectedCourse}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg pl-4 pr-10 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Visao Global</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Global Summary Cards */}
        {!selectedCourse && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <SummaryCard
                icon={<Users className="w-8 h-8 opacity-80" />}
                value={summary.activeStudents}
                label="Alunos Ativos"
                subtitle={`em ${courseSummary.filter(c => c.activeStudents > 0).length} cursos`}
                gradient="from-blue-500 to-blue-600"
              />
              <SummaryCard
                icon={<CheckCircle className="w-8 h-8 opacity-80" />}
                value={summary.completedLessons}
                label="Aulas Concluidas"
                subtitle="total no LMS"
                gradient="from-green-500 to-green-600"
              />
              <SummaryCard
                icon={<Award className="w-8 h-8 opacity-80" />}
                value={summary.totalCertificates}
                label="Certificados"
                subtitle="emitidos"
                gradient="from-amber-500 to-amber-600"
              />
              <SummaryCard
                icon={<GraduationCap className="w-8 h-8 opacity-80" />}
                value={summary.quizzesApproved}
                label="Quizzes Aprovados"
                subtitle="tentativas aprovadas"
                gradient="from-purple-500 to-purple-600"
              />
            </div>

            {/* Activity Chart */}
            <ActivityChart data={activityChart} />

            {/* Courses Overview + Inactive Students */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Course summary */}
              <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-blue-600" />
                  Alunos por Curso
                </h2>
                <div className="space-y-3">
                  {courseSummary
                    .filter(c => c.activeStudents > 0)
                    .sort((a, b) => b.activeStudents - a.activeStudents)
                    .map(c => (
                      <button
                        key={c.courseId}
                        onClick={() => handleCourseChange(c.courseId)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors text-left"
                      >
                        <span className="font-medium text-gray-900 truncate mr-2">{c.title}</span>
                        <span className="text-sm font-bold text-blue-600 flex-shrink-0">
                          {c.activeStudents} {c.activeStudents === 1 ? 'aluno' : 'alunos'}
                        </span>
                      </button>
                    ))}
                  {courseSummary.filter(c => c.activeStudents > 0).length === 0 && (
                    <p className="text-gray-500 text-sm">Nenhum aluno matriculado</p>
                  )}
                </div>
              </div>

              {/* Inactive students */}
              <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Alunos Inativos ({'>'}7 dias)
                </h2>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {inactiveStudents.length === 0 ? (
                    <p className="text-gray-500 text-sm">Nenhum aluno inativo</p>
                  ) : (
                    inactiveStudents.map(s => (
                      <div key={s.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{s.name}</p>
                          <p className="text-xs text-gray-500 truncate">{s.email}</p>
                        </div>
                        <StatusBadge
                          daysSince={s.daysSince}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Course-specific view */}
        {selectedCourse && (
          <>
            {isLoadingCourse ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : courseData ? (
              <CourseView data={courseData} />
            ) : (
              <p className="text-gray-500 py-8 text-center">Sem dados para este curso</p>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

// --- Sub-components ---

function SummaryCard({ icon, value, label, subtitle, gradient }: {
  icon: React.ReactNode;
  value: number;
  label: string;
  subtitle: string;
  gradient: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow`}>
      <div className="flex items-center justify-between mb-4">
        {icon}
        <span className="text-3xl font-bold">{value}</span>
      </div>
      <h3 className="text-lg font-semibold mb-1">{label}</h3>
      <p className="text-sm opacity-90">{subtitle}</p>
    </div>
  );
}

function StatusBadge({ daysSince }: { daysSince: number }) {
  if (daysSince > 30) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex-shrink-0">
        {daysSince}d inativo
      </span>
    );
  }
  if (daysSince > 7) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 flex-shrink-0">
        {daysSince}d em risco
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex-shrink-0">
      ativo
    </span>
  );
}

function ActivityChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-6 h-6 text-indigo-600" />
        <h2 className="text-xl font-bold text-gray-900">Atividade (Ultimos 30 dias)</h2>
      </div>

      <div className="overflow-x-auto">
        <div className="flex items-end gap-1 min-w-max h-48">
          {data.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhuma atividade registrada</p>
          ) : (
            data.map((day) => {
              const height = (day.count / maxCount) * 100;
              return (
                <div key={day.date} className="flex flex-col items-center gap-1 flex-1 min-w-[24px]">
                  {day.count > 0 && (
                    <div className="text-[10px] font-semibold text-gray-700">{day.count}</div>
                  )}
                  <div
                    className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t transition-all hover:from-indigo-700 hover:to-indigo-500"
                    style={{ height: `${Math.max(height, day.count > 0 ? 4 : 1)}%` }}
                    title={`${day.date}: ${day.count} atividades`}
                  />
                  <div className="text-[9px] text-gray-500 -rotate-45 origin-top-left whitespace-nowrap mt-1">
                    {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function CourseView({ data }: { data: CourseData }) {
  const { funnel, moduleProgress, quizStats, students, activityChart } = data;
  const course = courses.find(c => c.id === data.courseId);

  return (
    <>
      {/* Funnel */}
      <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Funil — {course?.title || data.courseId}
        </h2>
        <div className="space-y-3">
          <FunnelBar label="Matriculados" value={funnel.enrolled} max={funnel.enrolled} color="bg-blue-500" />
          <FunnelBar label="Iniciaram" value={funnel.started} max={funnel.enrolled} color="bg-indigo-500" />
          <FunnelBar label="Concluiram 100%" value={funnel.completedAll} max={funnel.enrolled} color="bg-green-500" />
          <FunnelBar label="Certificados" value={funnel.certified} max={funnel.enrolled} color="bg-amber-500" />
        </div>
      </div>

      {/* Module Progress + Quiz Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Module progress */}
        <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Progresso por Modulo</h2>
          {moduleProgress.length === 0 ? (
            <p className="text-gray-500 text-sm">Sem modulos</p>
          ) : (
            <div className="space-y-4">
              {moduleProgress.map(m => (
                <div key={m.moduleId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate mr-2">{m.title}</span>
                    <span className="text-sm font-bold text-gray-700">{m.avgCompletion}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${m.avgCompletion}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{m.totalLessons} aulas</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quiz stats */}
        <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Resumo de Quizzes</h2>
          {quizStats.length === 0 ? (
            <p className="text-gray-500 text-sm">Sem quizzes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-2 font-semibold text-gray-700">Aula</th>
                    <th className="text-center py-2 px-2 font-semibold text-gray-700">Media</th>
                    <th className="text-center py-2 px-2 font-semibold text-gray-700">Aprov.</th>
                    <th className="text-center py-2 pl-2 font-semibold text-gray-700">Tent.</th>
                  </tr>
                </thead>
                <tbody>
                  {quizStats.map(q => (
                    <tr key={q.quizId} className="border-b border-gray-100">
                      <td className="py-2 pr-2 text-gray-900 truncate max-w-[160px]">{q.lessonTitle}</td>
                      <td className="py-2 px-2 text-center font-medium">{q.avgScore}%</td>
                      <td className="py-2 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          q.passRate >= 70 ? 'bg-green-100 text-green-800' :
                          q.passRate >= 50 ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {q.passRate}%
                        </span>
                      </td>
                      <td className="py-2 pl-2 text-center text-gray-600">{q.totalAttempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Activity chart */}
      <ActivityChart data={activityChart} />

      {/* Students table */}
      <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6 mt-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Alunos ({students.length})
        </h2>
        {students.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhum aluno matriculado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-2 font-semibold text-gray-700">Nome</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-700">Email</th>
                  <th className="text-center py-2 px-2 font-semibold text-gray-700">Progresso</th>
                  <th className="text-center py-2 px-2 font-semibold text-gray-700">Ultima Atividade</th>
                  <th className="text-center py-2 px-2 font-semibold text-gray-700">Quiz</th>
                  <th className="text-center py-2 pl-2 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.userId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 pr-2 font-medium text-gray-900 truncate max-w-[150px]">{s.name}</td>
                    <td className="py-2.5 px-2 text-gray-600 truncate max-w-[180px]">{s.email}</td>
                    <td className="py-2.5 px-2 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${s.completionPct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{s.completionPct}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center text-xs text-gray-600">
                      {s.lastAccess
                        ? new Date(s.lastAccess).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-center text-sm font-medium">
                      {s.avgQuizScore !== null ? `${s.avgQuizScore}%` : '—'}
                    </td>
                    <td className="py-2.5 pl-2 text-center">
                      <StatusBadge daysSince={s.daysSinceAccess ?? 999} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function FunnelBar({ label, value, max, color }: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-900 font-bold">{value} ({pct}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`${color} h-3 rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
