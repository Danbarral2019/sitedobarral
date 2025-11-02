'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import {
  Users, GraduationCap, FileText, TrendingUp, Download,
  Eye, Calendar, Activity, BookOpen, QrCode, Mail, BarChart3,
  Loader2, AlertCircle
} from 'lucide-react';
import { courses } from '@/data/courses';

interface AnalyticsData {
  users: {
    total: number;
    students: number;
    admins: number;
  };
  enrollments: {
    total: number;
    active: number;
    expired: number;
    lifetime: number;
    renewalRate: string;
  };
  documents: {
    total: number;
    public: number;
    private: number;
  };
  enunciados: {
    total: number;
    byEntity: Array<{
      entityType: string;
      count: number;
    }>;
  };
  topDocuments: Array<{
    id: string;
    title: string;
    type: string;
    category: string;
    accessCount: number;
  }>;
  topCourses: Array<{
    courseId: string;
    accessCount: number;
  }>;
  topUsers: Array<{
    id: string;
    name: string;
    email: string;
    accessCount: number;
  }>;
  accessByDay: Array<{
    date: string;
    count: number;
  }>;
  actionStats: Array<{
    action: string;
    count: number;
  }>;
  totalAccesses: number;
  blog: {
    total: number;
    published: number;
  };
  qrCodes: {
    total: number;
    active: number;
  };
  newsletter: {
    total: number;
    active: number;
  };
}

export default function AnalyticsDashboard() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  const [isLoadingTopContent, setIsLoadingTopContent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyAdminAndLoad = async () => {
      try {
        // Verificar admin
        const authResponse = await fetch('/api/auth/verify');
        if (!authResponse.ok) {
          router.push('/validar-acesso');
          return;
        }
        const authData = await authResponse.json();
        if (authData.user.role !== 'admin') {
          router.push('/area-restrita');
          return;
        }

        // FASE 1: Carregar apenas summary (rápido)
        setIsLoading(true);
        const summaryResponse = await fetch('/api/admin/analytics/summary');

        if (!summaryResponse.ok) {
          throw new Error('Erro ao carregar métricas');
        }

        const summaryData = await summaryResponse.json();

        // Inicializar data com summary
        setData({
          ...summaryData,
          enunciados: {
            total: summaryData.enunciados.total,
            byEntity: [],
          },
          topDocuments: [],
          topCourses: [],
          topUsers: [],
          accessByDay: [],
          actionStats: [],
        });

        setIsLoading(false);

        // FASE 2: Carregar gráficos (após 300ms)
        setTimeout(async () => {
          setIsLoadingCharts(true);
          try {
            const chartsResponse = await fetch('/api/admin/analytics/charts');
            if (chartsResponse.ok) {
              const chartsData = await chartsResponse.json();
              setData(prev => prev ? { ...prev, ...chartsData } : null);
            }
          } catch (err) {
            console.error('Erro ao carregar gráficos:', err);
          } finally {
            setIsLoadingCharts(false);
          }
        }, 300);

        // FASE 3: Carregar top content (após 600ms)
        setTimeout(async () => {
          setIsLoadingTopContent(true);
          try {
            const topContentResponse = await fetch('/api/admin/analytics/top-content');
            if (topContentResponse.ok) {
              const topContentData = await topContentResponse.json();
              setData(prev => prev ? { ...prev, ...topContentData } : null);
            }
          } catch (err) {
            console.error('Erro ao carregar top content:', err);
          } finally {
            setIsLoadingTopContent(false);
          }
        }, 600);

      } catch (err) {
        console.error('Erro:', err);
        setError('Erro ao carregar métricas');
        setIsLoading(false);
      }
    };

    verifyAdminAndLoad();
  }, [router]); // ✅ Dependência: router

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminLayout>
        <div className="p-8">
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-red-900 mb-1">Erro ao Carregar Métricas</h3>
              <p className="text-red-700">{error || 'Erro desconhecido'}</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Encontrar curso por ID
  const getCourseName = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    return course ? course.title : courseId;
  };

  // Traduzir ações
  const translateAction = (action: string) => {
    const translations: Record<string, string> = {
      login: 'Login',
      access: 'Acesso',
      download: 'Download',
      view: 'Visualização',
      upgrade_lifetime: 'Upgrade Vitalício',
    };
    return translations[action] || action;
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard de Analytics</h1>
              <p className="text-gray-600">Métricas e estatísticas do sistema</p>
            </div>
          </div>
        </div>

        {/* Cards de Estatísticas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Usuários */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">{data.users.total}</span>
            </div>
            <h3 className="text-lg font-semibold mb-1">Usuários</h3>
            <p className="text-sm opacity-90">
              {data.users.students} alunos · {data.users.admins} admins
            </p>
          </div>

          {/* Matrículas Ativas */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <GraduationCap className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">{data.enrollments.active}</span>
            </div>
            <h3 className="text-lg font-semibold mb-1">Matrículas Ativas</h3>
            <p className="text-sm opacity-90">
              {data.enrollments.lifetime} vitalícias · {data.enrollments.renewalRate}% taxa renovação
            </p>
          </div>

          {/* Acessos (30 dias) */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">{data.totalAccesses}</span>
            </div>
            <h3 className="text-lg font-semibold mb-1">Acessos (30 dias)</h3>
            <p className="text-sm opacity-90">
              Média: {(data.totalAccesses / 30).toFixed(0)} por dia
            </p>
          </div>

          {/* Documentos */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <FileText className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">{data.documents.total}</span>
            </div>
            <h3 className="text-lg font-semibold mb-1">Documentos</h3>
            <p className="text-sm opacity-90">
              {data.documents.public} públicos · {data.documents.private} privados
            </p>
          </div>
        </div>

        {/* Cards Secundários */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Blog Posts */}
          <div className="bg-white rounded-xl p-6 shadow-md border-2 border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Posts do Blog</h3>
                <p className="text-sm text-gray-600">{data.blog.published} publicados</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{data.blog.total}</div>
          </div>

          {/* QR Codes */}
          <div className="bg-white rounded-xl p-6 shadow-md border-2 border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <QrCode className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">QR Codes</h3>
                <p className="text-sm text-gray-600">{data.qrCodes.active} ativos</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{data.qrCodes.total}</div>
          </div>

          {/* Newsletter */}
          <div className="bg-white rounded-xl p-6 shadow-md border-2 border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Newsletter</h3>
                <p className="text-sm text-gray-600">{data.newsletter.active} ativos</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{data.newsletter.total}</div>
          </div>
        </div>

        {/* Card de Enunciados */}
        {data.enunciados && data.enunciados.total > 0 && (
          <div className="mb-8">
            <div className="bg-white rounded-xl p-6 shadow-md border-2 border-indigo-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Enunciados</h3>
                  <p className="text-sm text-gray-600">Distribuição por entidade</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-3xl font-bold text-indigo-600">{data.enunciados.total}</div>
                <div className="flex gap-3 flex-wrap">
                  {data.enunciados.byEntity.map((entity) => (
                    <span
                      key={entity.entityType}
                      className={`px-3 py-1 text-sm font-bold rounded-full ${
                        entity.entityType === 'IBDA' ? 'bg-purple-100 text-purple-800' :
                        entity.entityType === 'INCP' ? 'bg-indigo-100 text-indigo-800' :
                        entity.entityType === 'CJF' ? 'bg-cyan-100 text-cyan-800' :
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {entity.entityType}: {entity.count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Seções de Listas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Documentos Mais Acessados */}
          <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Documentos Mais Acessados</h2>
              {isLoadingTopContent && (
                <Loader2 className="w-5 h-5 animate-spin text-blue-600 ml-auto" />
              )}
            </div>

            <div className="space-y-3">
              {isLoadingTopContent ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : data.topDocuments.length === 0 ? (
                <p className="text-gray-600 text-sm">Nenhum acesso registrado nos últimos 30 dias</p>
              ) : (
                data.topDocuments.slice(0, 5).map((doc, index) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{doc.title}</p>
                      <p className="text-xs text-gray-600">{doc.category} · {doc.type}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-blue-600">
                      {doc.accessCount}
                      <Eye className="w-4 h-4" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cursos Mais Acessados */}
          <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <GraduationCap className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">Cursos Mais Acessados</h2>
              {isLoadingTopContent && (
                <Loader2 className="w-5 h-5 animate-spin text-green-600 ml-auto" />
              )}
            </div>

            <div className="space-y-3">
              {isLoadingTopContent ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : data.topCourses.length === 0 ? (
                <p className="text-gray-600 text-sm">Nenhum acesso registrado nos últimos 30 dias</p>
              ) : (
                data.topCourses.slice(0, 5).map((course, index) => (
                  <div key={course.courseId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{getCourseName(course.courseId || '')}</p>
                      <p className="text-xs text-gray-600">ID: {course.courseId}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-green-600">
                      {course.accessCount}
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Usuários Mais Ativos */}
          <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-900">Usuários Mais Ativos</h2>
              {isLoadingTopContent && (
                <Loader2 className="w-5 h-5 animate-spin text-purple-600 ml-auto" />
              )}
            </div>

            <div className="space-y-3">
              {isLoadingTopContent ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : data.topUsers.length === 0 ? (
                <p className="text-gray-600 text-sm">Nenhum acesso registrado nos últimos 30 dias</p>
              ) : (
                data.topUsers.slice(0, 5).map((user, index) => (
                  <div key={user.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="w-8 h-8 bg-purple-600 text-white rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-600 truncate">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-purple-600">
                      {user.accessCount}
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Ações por Tipo */}
          <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-bold text-gray-900">Ações por Tipo (30 dias)</h2>
              {isLoadingCharts && (
                <Loader2 className="w-5 h-5 animate-spin text-orange-600 ml-auto" />
              )}
            </div>

            <div className="space-y-3">
              {isLoadingCharts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                data.actionStats.map((stat) => (
                  <div key={stat.action} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {stat.action === 'download' && <Download className="w-5 h-5 text-orange-600" />}
                      {stat.action === 'view' && <Eye className="w-5 h-5 text-blue-600" />}
                      {stat.action === 'login' && <Users className="w-5 h-5 text-green-600" />}
                      {stat.action === 'access' && <Activity className="w-5 h-5 text-purple-600" />}
                      <span className="font-semibold text-gray-900">{translateAction(stat.action)}</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{stat.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Gráfico Simples de Acessos por Dia */}
        <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">Acessos por Dia (Últimos 30 dias)</h2>
            {isLoadingCharts && (
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600 ml-auto" />
            )}
          </div>

          <div className="overflow-x-auto">
            {isLoadingCharts ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="flex items-end gap-2 min-w-max h-64">
                {data.accessByDay.length === 0 ? (
                  <p className="text-gray-600 text-sm">Nenhum acesso registrado</p>
                ) : (
                  data.accessByDay.map((day) => {
                    const maxCount = Math.max(...data.accessByDay.map(d => d.count));
                    const height = (day.count / maxCount) * 100;

                    return (
                      <div key={day.date} className="flex flex-col items-center gap-2 flex-1 min-w-[40px]">
                        <div className="text-xs font-semibold text-gray-900">{day.count}</div>
                        <div
                          className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all hover:from-indigo-700 hover:to-indigo-500"
                          style={{ height: `${height}%` }}
                          title={`${day.date}: ${day.count} acessos`}
                        ></div>
                        <div className="text-xs text-gray-600 rotate-45 origin-top-left whitespace-nowrap">
                          {new Date(day.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
