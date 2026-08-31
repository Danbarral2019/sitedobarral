'use client';

import { useState, useMemo } from 'react';
import {
  GraduationCap,
  ChevronRight,
  ChevronDown,
  FileText,
  Map,
  BookOpen,
  Layers,
  Library,
  PlayCircle,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { courses } from '@/data/courses';

interface Document {
  id: string;
  title: string;
  description?: string;
  category: string;
  type: string;
  url?: string;
  courseId?: string;
  isCommon?: boolean;
}

interface DashboardCourseCardProps {
  documents: Record<string, Document[]>;
  enrolledCourseIds: string[];
  modulesData?: Record<string, { moduleCount: number; lessonCount: number }>;
  onDocumentClick: (doc: Document) => void;
}

const MATERIAL_SECTIONS = [
  { category: 'conteudo-programatico', title: 'Roteiro do Curso', icon: Map },
  { category: 'apostila', title: 'Material Principal', icon: BookOpen },
  { category: 'material-complementar', title: 'Material Complementar', icon: Layers },
  { category: 'bibliografia', title: 'Bibliografia', icon: Library },
];

const COURSE_MATERIAL_CATEGORIES = MATERIAL_SECTIONS.map((s) => s.category);

function getDocTypeLabel(type: string): string {
  const map: Record<string, string> = {
    pdf: 'PDF',
    link: 'Link',
    video: 'Vídeo',
    slide: 'Slides',
    doc: 'Documento',
  };
  return map[type] || type.toUpperCase();
}

export function DashboardCourseCard({
  documents,
  enrolledCourseIds,
  modulesData,
  onDocumentClick,
}: DashboardCourseCardProps) {
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

  const coursesData = useMemo(() => {
    const result: Array<{
      courseId: string;
      course: (typeof courses)[0];
      docs: Document[];
      hasLmsModules: boolean;
    }> = [];

    enrolledCourseIds.forEach((courseId) => {
      const course = courses.find((c) => c.id === courseId);
      if (!course) return;

      const courseDocs = documents[courseId] || [];
      const commonDocs = Object.values(documents)
        .flat()
        .filter((d) => d.isCommon && COURSE_MATERIAL_CATEGORIES.includes(d.category));

      const allDocs = [...courseDocs, ...commonDocs]
        .filter((d) => COURSE_MATERIAL_CATEGORIES.includes(d.category))
        .filter((doc, idx, self) => idx === self.findIndex((d) => d.id === doc.id));

      const hasLmsModules = (modulesData?.[courseId]?.moduleCount ?? 0) > 0;

      result.push({ courseId, course, docs: allDocs, hasLmsModules });
    });

    return result;
  }, [documents, enrolledCourseIds, modulesData]);

  if (coursesData.length === 0) return null;

  const toggleExpanded = (courseId: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  return (
    <div>
      <h3 className="font-serif text-brand-800 text-lg font-bold mb-3">Seus Cursos</h3>
      <div className="space-y-4">
        {coursesData.map(({ courseId, course, docs, hasLmsModules }) => {
          const isExpanded = expandedCourses.has(courseId);
          const totalMaterials = docs.length;
          const hasMaterials = totalMaterials > 0 || hasLmsModules;

          const sectionDocs = MATERIAL_SECTIONS.map((section) => ({
            ...section,
            docs: docs.filter((d) => d.category === section.category),
          })).filter((s) => s.docs.length > 0);

          return (
            <div key={courseId} className="bg-white border border-border-subtle rounded-[6px] overflow-hidden">
              {/* Course Header */}
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-brand-100 rounded-[6px] flex-shrink-0">
                    <GraduationCap className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-bold text-ink-primary leading-tight">
                      {course.title.split('(')[0].trim()}
                    </h4>
                    <p className="text-sm text-ink-muted mt-1 line-clamp-2">
                      {course.shortDescription}
                    </p>
                    {totalMaterials > 0 && (
                      <span className="inline-block mt-2 text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-[3px]">
                        {totalMaterials} {totalMaterials === 1 ? 'material' : 'materiais'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* CTA Bar */}
              <div className="px-5 py-3 bg-brand-50/50 border-t border-border-subtle flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-brand-800 min-w-0">
                  <PlayCircle className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  {modulesData && modulesData[courseId]?.moduleCount > 0 ? (
                    <span className="font-medium truncate">
                      {modulesData[courseId].moduleCount}{' '}
                      {modulesData[courseId].moduleCount === 1 ? 'módulo' : 'módulos'} &middot;{' '}
                      {modulesData[courseId].lessonCount}{' '}
                      {modulesData[courseId].lessonCount === 1 ? 'aula' : 'aulas'}
                    </span>
                  ) : (
                    <span className="font-medium">Acessar curso</span>
                  )}
                </div>
                <Link
                  href={`/area-restrita/curso/${course.slug}`}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-[6px] font-semibold text-sm hover:bg-brand-700 transition-colors flex-shrink-0"
                >
                  Entrar
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Materials Accordion */}
              {hasMaterials && totalMaterials > 0 && (
                <div className="border-t border-border-subtle">
                  <button
                    onClick={() => toggleExpanded(courseId)}
                    className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium text-ink-muted hover:text-ink-secondary hover:bg-surface-raised transition-colors"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                    {isExpanded
                      ? 'Ocultar materiais'
                      : `Ver ${totalMaterials} ${totalMaterials === 1 ? 'material' : 'materiais'}`}
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4 space-y-4">
                      {sectionDocs.map((section) => {
                        const Icon = section.icon;
                        return (
                          <div key={section.category}>
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="w-4 h-4 text-brand-500" />
                              <span className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
                                {section.title}
                              </span>
                              <span className="text-xs text-ink-muted">({section.docs.length})</span>
                            </div>
                            <div className="space-y-1.5">
                              {section.docs.map((doc) => (
                                <button
                                  key={doc.id}
                                  onClick={() => onDocumentClick(doc)}
                                  className="w-full text-left bg-surface-raised hover:bg-surface-deep rounded-[6px] p-3.5 transition-all group flex items-center gap-3"
                                >
                                  <FileText className="w-4 h-4 text-ink-muted group-hover:text-brand-500 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-ink-primary truncate group-hover:text-brand-600 transition-colors">
                                      {doc.title}
                                    </p>
                                    {doc.description && (
                                      <p className="text-xs text-ink-muted truncate mt-0.5">
                                        {doc.description}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-ink-muted flex-shrink-0">
                                    {getDocTypeLabel(doc.type)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {!hasMaterials && (
                <div className="px-5 py-6 border-t border-border-subtle text-center">
                  <Clock className="w-5 h-5 text-ink-muted mx-auto mb-2" />
                  <p className="text-sm text-ink-muted">Conteúdo em preparação</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
