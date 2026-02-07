'use client';

import { ChevronRight, GraduationCap, Lock } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  slug: string;
  isEnrolled: boolean; // Indica se o aluno está matriculado
}

interface CoursesSidebarProps {
  courses: Course[];
  selectedCourseId: string | null;
  onCourseSelect: (courseId: string) => void;
  documentCounts: Record<string, number>;
}

export default function CoursesSidebar({
  courses,
  selectedCourseId,
  onCourseSelect,
  documentCounts,
}: CoursesSidebarProps) {
  // Selecionar curso e fechar sidebar em mobile
  const handleCourseClick = (course: Course) => {
    onCourseSelect(course.id);
  };

  return (
    <>
      {/* Sidebar - apenas desktop agora */}
      <aside className="hidden lg:block lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-80 bg-white border-r-2 border-gray-200 shadow-xl overflow-y-auto">
        {/* Header da Sidebar */}
        <div className="sticky top-0 bg-gradient-to-r from-brand-600 to-brand-700 text-white p-6 z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Catálogo de Cursos</h2>
              <p className="text-sm text-brand-100">{courses.filter(c => c.isEnrolled).length} matriculado{courses.filter(c => c.isEnrolled).length !== 1 ? 's' : ''} de {courses.length}</p>
            </div>
          </div>
        </div>

        {/* Lista de Cursos */}
        <div className="p-4">
          {courses.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-gray-600">Nenhum curso disponível</p>
            </div>
          ) : (
            <div className="space-y-3">
              {courses.map((course) => {
                const isSelected = selectedCourseId === course.id;
                const isEnrolled = course.isEnrolled;
                const docCount = isEnrolled ? (documentCounts[course.id] || 0) : 0;

                return (
                  <button
                    key={course.id}
                    onClick={() => handleCourseClick(course)}
                    className={`w-full text-left p-4 lg:p-4 rounded-xl border-2 transition-all min-h-[80px] lg:min-h-0 ${
                      !isEnrolled
                        ? 'bg-gray-50 border-gray-300 opacity-75 hover:opacity-100 hover:border-gray-400'
                        : isSelected
                        ? 'bg-gradient-to-r from-brand-50 to-brand-100 border-brand-400 shadow-md'
                        : 'bg-white border-gray-200 hover:border-brand-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {!isEnrolled && (
                            <Lock className="w-4 h-4 lg:w-4 lg:h-4 text-gray-500 flex-shrink-0" />
                          )}
                          <h3 className={`font-bold text-sm lg:text-sm line-clamp-2 ${
                            !isEnrolled
                              ? 'text-gray-600'
                              : isSelected
                              ? 'text-brand-900'
                              : 'text-gray-900'
                          }`}>
                            {course.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {isEnrolled ? (
                            <span className={`text-xs lg:text-xs font-medium px-2 py-1 rounded-full ${
                              isSelected
                                ? 'bg-brand-200 text-brand-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {docCount} {docCount === 1 ? 'material' : 'materiais'}
                            </span>
                          ) : (
                            <span className="text-xs lg:text-xs font-medium px-2 py-1 rounded-full bg-orange-100 text-orange-700">
                              Curso bloqueado
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`flex-shrink-0 ${
                        !isEnrolled
                          ? 'text-gray-400'
                          : isSelected
                          ? 'text-brand-600'
                          : 'text-gray-400'
                      }`}>
                        <ChevronRight className="w-5 h-5 lg:w-5 lg:h-5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer da Sidebar */}
        <div className="sticky bottom-0 p-4 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            {courses.filter(c => !c.isEnrolled).length > 0 && (
              <>
                <Lock className="w-3 h-3 inline mr-1" />
                Cursos bloqueados: clique para saber mais
              </>
            )}
          </p>
        </div>
      </aside>
    </>
  );
}
