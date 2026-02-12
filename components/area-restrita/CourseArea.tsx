'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Map,
  BookOpen,
  Layers,
  Library,
  GraduationCap,
  ChevronRight,
  ChevronDown,
  FileText,
  PlayCircle,
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

interface CourseAreaProps {
  documents: Record<string, Document[]>;
  enrolledCourseIds: string[];
  onDocumentClick: (doc: Document) => void;
  modulesData?: Record<string, { moduleCount: number; lessonCount: number }>;
}

const TRAIL_STEPS = [
  {
    id: 'conteudo-programatico',
    category: 'conteudo-programatico',
    title: 'Seu Roteiro',
    subtitle: 'O que você vai aprender',
    icon: Map,
    color: '#4f46e5', // brand/indigo
    gradient: 'from-brand-500 to-brand-700',
    bgLight: 'bg-brand-50',
    textColor: 'text-brand-600',
    borderColor: 'border-brand-200',
    ringColor: 'ring-brand-300',
  },
  {
    id: 'apostila',
    category: 'apostila',
    title: 'Material Principal',
    subtitle: 'O conteúdo central do curso',
    icon: BookOpen,
    color: '#2563eb', // blue
    gradient: 'from-blue-500 to-blue-700',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    ringColor: 'ring-blue-300',
  },
  {
    id: 'material-complementar',
    category: 'material-complementar',
    title: 'Aprofundamento',
    subtitle: 'Materiais extras para ir além',
    icon: Layers,
    color: '#d97706', // amber
    gradient: 'from-amber-500 to-orange-600',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-200',
    ringColor: 'ring-amber-300',
  },
  {
    id: 'bibliografia',
    category: 'bibliografia',
    title: 'Referências',
    subtitle: 'Fontes e livros recomendados',
    icon: Library,
    color: '#059669', // green
    gradient: 'from-green-500 to-emerald-600',
    bgLight: 'bg-green-50',
    textColor: 'text-green-600',
    borderColor: 'border-green-200',
    ringColor: 'ring-green-300',
  },
];

const COURSE_MATERIAL_CATEGORIES = TRAIL_STEPS.map((s) => s.category);

// Map document type to friendly label
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
}: CourseAreaProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    enrolledCourseIds.length === 1 ? enrolledCourseIds[0] : null
  );
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const coursesMaterials = useMemo(() => {
    const result: Record<string, { course: (typeof courses)[0]; docs: Document[] }> = {};

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

      if (allDocs.length > 0) {
        result[courseId] = { course, docs: allDocs };
      }
    });

    return result;
  }, [documents, enrolledCourseIds]);

  const courseIds = Object.keys(coursesMaterials);
  const hasMultipleCourses = courseIds.length > 1;
  const activeCourseId = selectedCourseId || courseIds[0];
  const activeCourse = coursesMaterials[activeCourseId];

  // Build the visible steps (only steps that have documents)
  const visibleSteps = useMemo(() => {
    if (!activeCourse) return [];
    return TRAIL_STEPS.filter(
      (step) => activeCourse.docs.filter((d) => d.category === step.category).length > 0
    );
  }, [activeCourse]);

  // Total materials count
  const totalMaterials = activeCourse?.docs.length || 0;

  // Auto-expand if only one step has docs
  useEffect(() => {
    if (visibleSteps.length === 1) {
      setExpandedStep(visibleSteps[0].id);
    } else {
      setExpandedStep(null);
    }
  }, [visibleSteps]);

  if (!activeCourse || activeCourse.docs.length === 0) {
    return null;
  }

  const getDocsForStep = (category: string) =>
    activeCourse.docs.filter((d) => d.category === category);

  const handleStepClick = (stepId: string) => {
    setExpandedStep((prev) => (prev === stepId ? null : stepId));
  };

  const expandedStepData = visibleSteps.find((s) => s.id === expandedStep);
  const expandedDocs = expandedStepData ? getDocsForStep(expandedStepData.category) : [];

  return (
    <div className="mb-6 space-y-4">
      {/* Course Selector (multi-course) */}
      {hasMultipleCourses && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {courseIds.map((courseId) => {
            const courseMat = coursesMaterials[courseId];
            const isActive = courseId === activeCourseId;
            return (
              <button
                key={courseId}
                onClick={() => setSelectedCourseId(courseId)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  isActive
                    ? 'border-brand-500 bg-brand-50/30 shadow-md'
                    : 'border-gray-100 bg-white hover:border-brand-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-brand-100' : 'bg-gray-100'}`}>
                    <GraduationCap className={`w-5 h-5 ${isActive ? 'text-brand-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-bold line-clamp-1 ${isActive ? 'text-brand-900' : 'text-gray-800'}`}>
                      {courseMat.course.title.split('(')[0].trim()}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                      {courseMat.course.shortDescription}
                    </p>
                    <span className={`inline-block text-xs font-semibold mt-1 ${isActive ? 'text-brand-600' : 'text-gray-400'}`}>
                      {courseMat.docs.length} {courseMat.docs.length === 1 ? 'material' : 'materiais'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Unified Course Card */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Course Header */}
        <div className="p-5 lg:p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl shadow-md flex-shrink-0">
              <GraduationCap className="w-6 h-6 lg:w-7 lg:h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg lg:text-xl font-bold text-gray-900 leading-tight">
                {activeCourse.course.title.split('(')[0].trim()}
              </h2>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {activeCourse.course.shortDescription}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">
                  {totalMaterials} {totalMaterials === 1 ? 'material disponível' : 'materiais disponíveis'}
                </span>
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  {visibleSteps.length} {visibleSteps.length === 1 ? 'etapa' : 'etapas'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* LMS Module Banner */}
        {modulesData && modulesData[activeCourseId]?.moduleCount > 0 && (
          <div className="px-5 py-4 bg-gradient-to-r from-brand-50/50 to-purple-50/50 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2 bg-brand-100 rounded-lg flex-shrink-0">
                  <PlayCircle className="w-4 h-4 text-brand-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-900">
                    {modulesData[activeCourseId].moduleCount}{' '}
                    {modulesData[activeCourseId].moduleCount === 1 ? 'módulo' : 'módulos'}{' '}
                    com {modulesData[activeCourseId].lessonCount}{' '}
                    {modulesData[activeCourseId].lessonCount === 1 ? 'aula estruturada' : 'aulas estruturadas'}
                  </p>
                </div>
              </div>
              <Link
                href={`/area-restrita/curso/${activeCourse.course.slug}`}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors flex-shrink-0"
              >
                Entrar no Curso
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Trail Steps */}
        <div className="p-5 border-t border-gray-100">

        {/* Desktop Steps as Cards (lg+) */}
        <div className="hidden lg:block">
        {/* Step Cards Row */}
        <div className="relative flex items-stretch gap-0">
          {/* Connecting line behind cards */}
          {visibleSteps.length > 1 && (
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex items-center justify-center pointer-events-none z-0">
              <div
                className="h-0.5 bg-gradient-to-r from-brand-200 via-blue-200 to-green-200"
                style={{
                  width: `${((visibleSteps.length - 1) / visibleSteps.length) * 100}%`,
                }}
              />
            </div>
          )}

          {visibleSteps.map((step, index) => {
            const Icon = step.icon;
            const docs = getDocsForStep(step.category);
            const isExpanded = expandedStep === step.id;

            return (
              <div
                key={step.id}
                className="relative flex-1 px-1.5 z-10"
              >
                <div
                  onClick={() => handleStepClick(step.id)}
                  className={`bg-white rounded-xl border p-4 cursor-pointer transition-all duration-200 h-full flex flex-col items-center text-center ${
                    isExpanded
                      ? `border-gray-300 shadow-lg ring-2 ${step.ringColor} ring-offset-1 scale-[1.02]`
                      : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
                  }`}
                >
                  {/* Step number badge */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center mb-2 text-xs font-bold ${
                    isExpanded ? `bg-gradient-to-br ${step.gradient} text-white` : 'bg-gray-100 text-gray-500'
                  }`}>
                    {index + 1}
                  </div>

                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-md mb-3`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Title */}
                  <h3
                    className={`text-sm font-bold transition-colors ${
                      isExpanded ? step.textColor : 'text-gray-800'
                    }`}
                  >
                    {step.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">{step.subtitle}</p>

                  {/* Count badge */}
                  <span className={`mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${step.bgLight} ${step.textColor}`}>
                    {docs.length} {docs.length === 1 ? 'material' : 'materiais'}
                  </span>

                  {/* Bottom colored border indicator */}
                  <div
                    className={`mt-auto pt-3 w-full border-t-2 transition-colors ${
                      isExpanded ? step.borderColor : 'border-transparent'
                    }`}
                    style={isExpanded ? { borderColor: step.color } : undefined}
                  />
                </div>

                {/* Triangle indicator when expanded */}
                {isExpanded && (
                  <div className="flex justify-center mt-1">
                    <div
                      className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[10px]"
                      style={{ borderBottomColor: step.color + '15' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Expanded Materials Panel (full width below cards) */}
        {expandedStepData && expandedDocs.length > 0 && (
          <div
            className="mt-2 rounded-2xl border p-5 transition-all"
            style={{
              backgroundColor: expandedStepData.color + '08',
              borderColor: expandedStepData.color + '30',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <expandedStepData.icon
                className="w-5 h-5"
                style={{ color: expandedStepData.color }}
              />
              <h3 className="font-bold" style={{ color: expandedStepData.color }}>
                {expandedStepData.title}
              </h3>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: expandedStepData.color + '15',
                  color: expandedStepData.color,
                }}
              >
                {expandedDocs.length}
              </span>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {expandedDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDocumentClick(doc);
                  }}
                  className="w-full text-left bg-white hover:bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group/card flex items-center gap-3"
                  style={{ borderLeftWidth: '3px', borderLeftColor: expandedStepData.color }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: expandedStepData.color + '12' }}
                  >
                    <FileText className="w-5 h-5" style={{ color: expandedStepData.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-gray-900 line-clamp-1 group-hover/card:text-brand-600 transition-colors">
                      {doc.title}
                    </h4>
                    {doc.description && (
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                        {doc.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {getDocTypeLabel(doc.type)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover/card:text-brand-500 flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Steps as Timeline Cards (< lg) */}
      <div className="lg:hidden space-y-0">
        {visibleSteps.map((step, index) => {
          const Icon = step.icon;
          const docs = getDocsForStep(step.category);
          const isExpanded = expandedStep === step.id;
          const isLast = index === visibleSteps.length - 1;

          return (
            <div key={step.id} className="relative">
              {/* Vertical connector line */}
              {!isLast && (
                <div className="absolute left-6 top-14 bottom-0 w-px border-l-2 border-dashed border-gray-200 z-0" />
              )}

              {/* Step card */}
              <div
                onClick={() => handleStepClick(step.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStepClick(step.id); }}
                className={`relative z-10 flex items-center gap-3 py-3 cursor-pointer`}
              >
                {/* Circle with number */}
                <div
                  className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-md flex-shrink-0 transition-all ${
                    isExpanded ? `ring-3 ring-offset-1 ${step.ringColor}` : ''
                  }`}
                >
                  <Icon className="w-5 h-5 text-white" />
                  <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center">
                    <span className="text-[10px] font-bold text-gray-700">{index + 1}</span>
                  </div>
                </div>

                {/* Text + count */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-bold ${
                      isExpanded ? step.textColor : 'text-gray-800'
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-400">{step.subtitle}</p>
                  <span className={`inline-block text-xs font-semibold mt-0.5 px-2 py-0.5 rounded-full ${step.bgLight} ${step.textColor}`}>
                    {docs.length} {docs.length === 1 ? 'material' : 'materiais'}
                  </span>
                </div>

                {/* Expand indicator */}
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </div>

              {/* Expanded documents */}
              {isExpanded && docs.length > 0 && (
                <div className="relative z-10 ml-6 pl-6 pb-3 space-y-2">
                  {docs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDocumentClick(doc);
                      }}
                      className="w-full text-left bg-white rounded-xl p-3.5 border border-gray-100 hover:shadow-sm transition-all group/card flex items-center gap-3"
                      style={{ borderLeftWidth: '3px', borderLeftColor: step.color }}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: step.color + '12' }}
                      >
                        <FileText className="w-4 h-4" style={{ color: step.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-gray-900 line-clamp-1 group-hover/card:text-brand-600 transition-colors">
                          {doc.title}
                        </h4>
                        {doc.description && (
                          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                            {doc.description}
                          </p>
                        )}
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 mt-1 inline-block">
                          {getDocTypeLabel(doc.type)}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover/card:text-brand-500 flex-shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>{/* close trail steps wrapper */}
      </div>{/* close unified course card */}
    </div>
  );
}
