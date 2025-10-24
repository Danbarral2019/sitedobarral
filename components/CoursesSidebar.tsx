'use client';

import { useState } from 'react';
import { ChevronRight, GraduationCap, Menu, X } from 'lucide-react';

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

  // Toggle da sidebar em mobile
  const toggleSidebar = () => setIsOpen(!isOpen);

  // Selecionar curso e fechar sidebar em mobile
  const handleCourseClick = (courseId: string) => {
    onCourseSelect(courseId);
    setIsOpen(false);
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
        className={`fixed top-0 left-0 h-full bg-white border-r-2 border-gray-200 shadow-xl z-40 transition-transform duration-300 overflow-y-auto ${
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
      </aside>
    </>
  );
}
