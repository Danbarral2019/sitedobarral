'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, GraduationCap, Menu, X } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  slug: string;
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
  const [isMinimized, setIsMinimized] = useState(false);

  // Toggle da sidebar em mobile
  const toggleSidebar = () => setIsOpen(!isOpen);

  // Auto-minimizar ao selecionar um curso (apenas desktop)
  useEffect(() => {
    if (selectedCourseId && window.innerWidth >= 1024) {
      setIsMinimized(true);
    }
  }, [selectedCourseId]);

  // Selecionar curso e fechar sidebar em mobile
  const handleCourseClick = (courseId: string) => {
    onCourseSelect(courseId);
    setIsOpen(false);
  };

  // Função para obter iniciais do curso
  const getCourseInitials = (title: string): string => {
    const words = title.split(' ').filter(word => word.length > 2);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return title.substring(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Botão de toggle (mobile) */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 lg:hidden bg-blue-600 text-white p-3 rounded-xl shadow-lg hover:bg-blue-700 transition-colors"
        aria-label="Menu de cursos"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
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
        className={`fixed top-0 left-0 h-full bg-white border-r-2 border-gray-200 shadow-xl z-40 transition-all duration-300 overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] ${
          isMinimized ? 'lg:w-20' : 'lg:w-80'
        }`}
      >
        {/* Versão Expandida */}
        {!isMinimized && (
          <>
            {/* Header da Sidebar */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Meus Cursos</h2>
                  <p className="text-sm text-blue-100">{courses.length} curso{courses.length !== 1 ? 's' : ''} matriculado{courses.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            {/* Lista de Cursos */}
            <div className="p-4">
              {courses.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <p className="text-gray-600">Nenhum curso matriculado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {courses.map((course) => {
                    const isSelected = selectedCourseId === course.id;
                    const docCount = documentCounts[course.id] || 0;

                    return (
                      <button
                        key={course.id}
                        onClick={() => handleCourseClick(course.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          isSelected
                            ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-400 shadow-md'
                            : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-bold text-sm mb-2 line-clamp-2 ${
                              isSelected ? 'text-blue-900' : 'text-gray-900'
                            }`}>
                              {course.title}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                isSelected
                                  ? 'bg-blue-200 text-blue-800'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {docCount} {docCount === 1 ? 'material' : 'materiais'}
                              </span>
                            </div>
                          </div>
                          <div className={`flex-shrink-0 ${
                            isSelected ? 'text-blue-600' : 'text-gray-400'
                          }`}>
                            <ChevronRight className="w-5 h-5" />
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
                Selecione um curso para ver os materiais
              </p>
            </div>
          </>
        )}

        {/* Versão Minimizada */}
        {isMinimized && (
          <div className="py-4 flex flex-col items-center gap-3 h-full">
            {/* Botão para expandir */}
            <button
              onClick={() => setIsMinimized(false)}
              className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl flex items-center justify-center hover:shadow-lg transition-shadow mb-2"
              title="Expandir menu"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Lista de cursos minimizada */}
            <div className="space-y-3 flex-1 overflow-y-auto w-full px-2">
              {courses.map((course) => {
                const isSelected = selectedCourseId === course.id;
                const initials = getCourseInitials(course.title);
                const docCount = documentCounts[course.id] || 0;

                return (
                  <button
                    key={course.id}
                    onClick={() => handleCourseClick(course.id)}
                    className={`w-14 h-14 rounded-xl border-2 transition-all font-bold text-sm flex items-center justify-center relative group ${
                      isSelected
                        ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white border-blue-400 shadow-lg'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:shadow-md'
                    }`}
                    title={course.title}
                  >
                    {initials}
                    {docCount > 0 && (
                      <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                        isSelected ? 'bg-yellow-400 text-gray-900' : 'bg-blue-600 text-white'
                      }`}>
                        {docCount}
                      </span>
                    )}

                    {/* Tooltip ao hover */}
                    <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                      {course.title}
                      <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
