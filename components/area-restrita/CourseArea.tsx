'use client';

import { useState, useMemo } from 'react';
import {
  Map,
  BookOpen,
  Layers,
  Library,
  GraduationCap,
  ChevronRight,
  FileText,
  PlayCircle,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { courses } from '@/data/courses';
import RecommendedSites from '@/components/RecommendedSites';

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

interface SiteType {
  id: string;
  title: string;
  description: string;
  url: string;
  faviconUrl?: string | null;
  category?: string | null;
}

interface CourseAreaProps {
  documents: Record<string, Document[]>;
  enrolledCourseIds: string[];
  onDocumentClick: (doc: Document) => void;
  modulesData?: Record<string, { moduleCount: number; lessonCount: number }>;
  sites?: Record<string, SiteType[]>;
}

const MATERIAL_SECTIONS = [
  {
    category: 'conteudo-programatico',
    title: 'Roteiro do Curso',
    icon: Map,
    color: 'indigo',
    accent: '#4f46e5',
  },
  {
    category: 'apostila',
    title: 'Material Principal',
    icon: BookOpen,
    color: 'blue',
    accent: '#2563eb',
  },
  {
    category: 'material-complementar',
    title: 'Material Complementar',
    icon: Layers,
    color: 'amber',
    accent: '#d97706',
  },
  {
    category: 'bibliografia',
    title: 'Bibliografia',
    icon: Library,
    color: 'green',
    accent: '#059669',
  },
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

export default function CourseArea({
  documents,
  enrolledCourseIds,
  onDocumentClick,
  modulesData,
  sites,
}: CourseAreaProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    enrolledCourseIds.length === 1 ? enrolledCourseIds[0] : null
  );

  // Build course data for ALL enrolled courses (not just those with materials)
  const coursesData = useMemo(() => {
    const result: Record<
      string,
      {
        course: (typeof courses)[0];
        docs: Document[];
        hasLmsModules: boolean;
      }
    > = {};

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

      // Include ALL enrolled courses, even without materials
      result[courseId] = { course, docs: allDocs, hasLmsModules };
    });

    return result;
  }, [documents, enrolledCourseIds, modulesData]);

  const courseIds = Object.keys(coursesData);
  const hasMultipleCourses = courseIds.length > 1;
  const activeCourseId = selectedCourseId || courseIds[0];
  const activeCourse = coursesData[activeCourseId];

  if (!activeCourse) return null;

  // Group documents by section
  const sectionDocs = MATERIAL_SECTIONS.map((section) => ({
    ...section,
    docs: activeCourse.docs.filter((d) => d.category === section.category),
  })).filter((s) => s.docs.length > 0);

  const totalMaterials = activeCourse.docs.length;
  const hasMaterials = totalMaterials > 0 || activeCourse.hasLmsModules;

  return (
    <div className="mb-6 space-y-4">
      {/* Course Selector (multi-course) */}
      {hasMultipleCourses && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {courseIds.map((courseId) => {
            const data = coursesData[courseId];
            const isActive = courseId === activeCourseId;
            const docCount = data.docs.length;
            const moduleCount = modulesData?.[courseId]?.moduleCount ?? 0;
            const hasContent = docCount > 0 || moduleCount > 0;

            return (
              <button
                key={courseId}
                onClick={() => setSelectedCourseId(courseId)}
                className={`text-left p-4 rounded-[6px] border-2 transition-all ${
                  isActive
                    ? 'border-brand-500 bg-brand-50/30'
                    : 'border-border-subtle bg-white hover:border-brand-300 hover:'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-[6px] ${isActive ? 'bg-brand-100' : 'bg-surface-deep'}`}
                  >
                    <GraduationCap
                      className={`w-5 h-5 ${isActive ? 'text-brand-600' : 'text-ink-muted'}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`text-sm font-bold line-clamp-1 ${isActive ? 'text-brand-900' : 'text-ink-secondary'}`}
                    >
                      {data.course.title.split('(')[0].trim()}
                    </h3>
                    <p className="text-xs text-ink-muted line-clamp-1 mt-0.5">
                      {data.course.shortDescription}
                    </p>
                    <span
                      className={`inline-block text-xs font-semibold mt-1 ${
                        hasContent
                          ? isActive
                            ? 'text-brand-600'
                            : 'text-ink-muted'
                          : 'text-ink-muted italic'
                      }`}
                    >
                      {docCount > 0
                        ? `${docCount} ${docCount === 1 ? 'material' : 'materiais'}`
                        : moduleCount > 0
                          ? `${moduleCount} ${moduleCount === 1 ? 'módulo' : 'módulos'}`
                          : 'Em breve'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Unified Course Card */}
      <div className="bg-white rounded-[6px] border border-border-subtle overflow-hidden">
        {/* Course Header */}
        <div className="p-5 lg:p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-brand-700 rounded-[6px] flex-shrink-0 border border-border-subtle">
              <GraduationCap className="w-6 h-6 lg:w-7 lg:h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg lg:text-xl font-bold text-ink-primary leading-tight">
                {activeCourse.course.title.split('(')[0].trim()}
              </h2>
              <p className="text-sm text-ink-muted mt-1 line-clamp-2">
                {activeCourse.course.shortDescription}
              </p>
              {hasMaterials && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {totalMaterials > 0 && (
                    <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-[3px]">
                      {totalMaterials}{' '}
                      {totalMaterials === 1 ? 'material disponível' : 'materiais disponíveis'}
                    </span>
                  )}
                  {sectionDocs.length > 0 && (
                    <span className="text-xs font-semibold text-ink-muted bg-surface-deep px-2.5 py-1 rounded-[3px]">
                      {sectionDocs.length}{' '}
                      {sectionDocs.length === 1 ? 'categoria' : 'categorias'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Course Action Banner - always visible */}
        <div className="px-5 py-4 bg-brand-50/50 border-t border-border-subtle">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 bg-brand-100 rounded-[6px] flex-shrink-0">
                <PlayCircle className="w-4 h-4 text-brand-600" />
              </div>
              <div className="min-w-0">
                {modulesData && modulesData[activeCourseId]?.moduleCount > 0 ? (
                  <p className="text-sm font-semibold text-brand-900">
                    {modulesData[activeCourseId].moduleCount}{' '}
                    {modulesData[activeCourseId].moduleCount === 1 ? 'módulo' : 'módulos'} com{' '}
                    {modulesData[activeCourseId].lessonCount}{' '}
                    {modulesData[activeCourseId].lessonCount === 1
                      ? 'aula estruturada'
                      : 'aulas estruturadas'}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-brand-900">
                    Acesse a página completa do curso
                  </p>
                )}
              </div>
            </div>
            <Link
              href={`/area-restrita/curso/${activeCourse.course.slug}`}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-[6px] font-semibold text-sm hover:bg-brand-700 transition-colors flex-shrink-0"
            >
              Entrar no Curso
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Materials by Section - Clean Layout */}
        {sectionDocs.length > 0 && (
          <div className="border-t border-border-subtle">
            {sectionDocs.map((section, sectionIdx) => {
              const Icon = section.icon;
              return (
                <div
                  key={section.category}
                  className={sectionIdx > 0 ? 'border-t border-border-subtle' : ''}
                >
                  {/* Section Header */}
                  <div className="px-5 pt-4 pb-2 flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-[6px] flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: section.accent + '12' }}
                    >
                      <Icon className="w-4 h-4" style={{ color: section.accent }} />
                    </div>
                    <h3 className="text-sm font-bold text-ink-secondary">{section.title}</h3>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-[3px]"
                      style={{
                        backgroundColor: section.accent + '10',
                        color: section.accent,
                      }}
                    >
                      {section.docs.length}
                    </span>
                  </div>

                  {/* Document List */}
                  <div className="px-5 pb-4 space-y-2">
                    {section.docs.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => onDocumentClick(doc)}
                        className="w-full text-left bg-surface-raised hover:bg-surface-deep rounded-[6px] p-3.5 transition-all group/card flex items-center gap-3"
                      >
                        <div
                          className="w-9 h-9 rounded-[6px] flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: section.accent + '12' }}
                        >
                          <FileText
                            className="w-4 h-4"
                            style={{ color: section.accent }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-ink-primary line-clamp-1 group-hover/card:text-brand-600 transition-colors">
                            {doc.title}
                          </h4>
                          {doc.description && (
                            <p className="text-xs text-ink-muted line-clamp-1 mt-0.5">
                              {doc.description}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-ink-muted flex-shrink-0">
                          {getDocTypeLabel(doc.type)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-ink-muted group-hover/card:text-brand-500 flex-shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State - Course without materials */}
        {!hasMaterials && (
          <div className="px-5 py-8 border-t border-border-subtle text-center">
            <div className="inline-flex p-3 bg-surface-deep rounded-full mb-3">
              <Clock className="w-6 h-6 text-ink-muted" />
            </div>
            <p className="text-sm font-medium text-ink-muted">Conteúdo em preparação</p>
            <p className="text-xs text-ink-muted mt-1">
              Os materiais deste curso serão disponibilizados em breve.
            </p>
          </div>
        )}

        {/* Placeholder when no materials but has LMS */}
        {sectionDocs.length === 0 &&
          modulesData &&
          modulesData[activeCourseId]?.moduleCount > 0 && (
            <div className="px-5 py-4 border-t border-border-subtle">
              <p className="text-sm text-ink-muted italic">
                Materiais complementares em breve.
              </p>
            </div>
          )}

        {/* Integrated Sites */}
        {(() => {
          const courseSitesList = sites?.[activeCourseId];
          if (!courseSitesList || courseSitesList.length === 0) return null;
          return (
            <div className="p-5 border-t border-border-subtle">
              <RecommendedSites sites={courseSitesList} compact />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
