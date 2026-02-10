'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GraduationCap, BookOpen, Layers, ChevronRight, Loader2 } from 'lucide-react';
import { courses } from '@/data/courses';
import AdminLayout from '@/components/AdminLayout';

interface CourseCounts {
  courseId: string;
  moduleCount: number;
  lessonCount: number;
}

export default function LMSDashboardClient() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [countsMap, setCountsMap] = useState<Record<string, CourseCounts>>({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);

  const verifyAdmin = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify');
      if (!response.ok) {
        router.push('/validar-acesso');
        return;
      }
      const data = await response.json();
      if (data.user.role !== 'admin') {
        router.push('/area-restrita');
        return;
      }
    } catch {
      router.push('/validar-acesso');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const loadCounts = useCallback(async () => {
    setIsLoadingCounts(true);
    try {
      const results = await Promise.all(
        courses.map(async (course) => {
          try {
            const res = await fetch(`/api/admin/modules?courseId=${course.id}`);
            if (!res.ok) return { courseId: course.id, moduleCount: 0, lessonCount: 0 };
            const data = await res.json();
            const modules = data.modules || [];
            const lessonCount = modules.reduce(
              (sum: number, m: { lessons?: unknown[] }) => sum + (m.lessons?.length || 0),
              0
            );
            return { courseId: course.id, moduleCount: modules.length, lessonCount };
          } catch {
            return { courseId: course.id, moduleCount: 0, lessonCount: 0 };
          }
        })
      );
      const map: Record<string, CourseCounts> = {};
      for (const r of results) {
        map[r.courseId] = r;
      }
      setCountsMap(map);
    } catch {
      // silently fail
    } finally {
      setIsLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    verifyAdmin();
    loadCounts();
  }, [verifyAdmin, loadCounts]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  const shortenTitle = (title: string, maxLen = 60) => {
    if (title.length <= maxLen) return title;
    return title.substring(0, maxLen) + '...';
  };

  const totalModules = Object.values(countsMap).reduce((s, c) => s + c.moduleCount, 0);
  const totalLessons = Object.values(countsMap).reduce((s, c) => s + c.lessonCount, 0);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <GraduationCap className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Gerenciamento LMS</h1>
            </div>
            <p className="text-gray-600">
              Gerencie os modulos e licoes de cada curso
            </p>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cursos</p>
                  <p className="text-2xl font-bold text-gray-900">{courses.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Layers className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Modulos</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoadingCounts ? '-' : totalModules}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Licoes</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoadingCounts ? '-' : totalLessons}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Course cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const counts = countsMap[course.id];
              const moduleCount = counts?.moduleCount ?? 0;
              const lessonCount = counts?.lessonCount ?? 0;
              const hasModules = moduleCount > 0;

              return (
                <Link
                  key={course.id}
                  href={`/admin/lms/${course.id}`}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-3 leading-tight">
                    {shortenTitle(course.title)}
                  </h3>

                  {isLoadingCounts ? (
                    <div className="flex gap-4">
                      <div className="h-5 w-20 bg-gray-100 rounded animate-pulse" />
                      <div className="h-5 w-20 bg-gray-100 rounded animate-pulse" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1.5 text-gray-600">
                        <Layers className="w-4 h-4" />
                        {moduleCount} {moduleCount === 1 ? 'modulo' : 'modulos'}
                      </span>
                      <span className="flex items-center gap-1.5 text-gray-600">
                        <BookOpen className="w-4 h-4" />
                        {lessonCount} {lessonCount === 1 ? 'licao' : 'licoes'}
                      </span>
                    </div>
                  )}

                  {!isLoadingCounts && !hasModules && (
                    <div className="mt-3">
                      <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                        Sem modulos
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
