'use client';

import { useState } from 'react';
import { ChevronRight, GraduationCap, Menu, X, Lock } from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(false);

  // Toggle da sidebar em mobile
  const toggleSidebar = () => setIsOpen(!isOpen);

  // Selecionar curso e fechar sidebar em mobile
  const handleCourseClick = (course: Course) => {
    onCourseSelect(course.id);
    setIsOpen(false);
  };

  return (
    <>
      {/* Botão de toggle (mobile) */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 lg:hidden bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-xl shadow-xl hover:from-blue-700 hover:to-purple-700 transition-all flex items-center gap-2 min-h-[52px]"
        aria-label="Menu de cursos"
      >
        {isOpen ? (
          <>
            <X className="w-6 h-6" />
            <span className="font-bold text-sm">Fechar</span>
          </>
        ) : (
          <>
            <Menu className="w-6 h-6" />
            <span className="font-bold text-sm">Cursos</span>
          </>
        )}
      </button>

      {/* Overlay (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r-2 border-gray-200 shadow-xl z-40 transition-transform duration-300 overflow-y-auto w-[85vw] max-w-sm ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-80`}
      >
        {/* Header da Sidebar */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Catálogo de Cursos</h2>
              <p className="text-sm text-blue-100">{courses.filter(c => c.isEnrolled).length} matriculado{courses.filter(c => c.isEnrolled).length !== 1 ? 's' : ''} de {courses.length}</p>
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
                        ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-400 shadow-md'
                        : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
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
                              ? 'text-blue-900'
                              : 'text-gray-900'
                          }`}>
                            {course.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {isEnrolled ? (
                            <span className={`text-xs lg:text-xs font-medium px-2 py-1 rounded-full ${
                              isSelected
                                ? 'bg-blue-200 text-blue-800'
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
                          ? 'text-blue-600'
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
