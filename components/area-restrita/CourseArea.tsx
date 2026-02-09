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
} from 'lucide-react';
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
}

const TRAIL_STEPS = [
  {
    id: 'conteudo-programatico',
    category: 'conteudo-programatico',
    title: 'Seu Roteiro',
    subtitle: 'O que você vai aprender',
    icon: Map,
    gradient: 'from-brand-500 to-brand-700',
    bgLight: 'bg-brand-50',
    textColor: 'text-brand-600',
    borderColor: 'border-brand-200',
  },
  {
    id: 'apostila',
    category: 'apostila',
    title: 'Material Principal',
    subtitle: 'O conteúdo central do curso',
    icon: BookOpen,
    gradient: 'from-blue-500 to-blue-700',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
  },
  {
    id: 'material-complementar',
    category: 'material-complementar',
    title: 'Aprofundamento',
    subtitle: 'Materiais extras para ir além',
    icon: Layers,
    gradient: 'from-amber-500 to-orange-600',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-200',
  },
  {
    id: 'bibliografia',
    category: 'bibliografia',
    title: 'Referências',
    subtitle: 'Fontes e livros recomendados',
    icon: Library,
    gradient: 'from-green-500 to-emerald-600',
    bgLight: 'bg-green-50',
    textColor: 'text-green-600',
    borderColor: 'border-green-200',
  },
];

const COURSE_MATERIAL_CATEGORIES = TRAIL_STEPS.map((s) => s.category);

export default function CourseArea({
  documents,
  enrolledCourseIds,
  onDocumentClick,
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
    <div className="mb-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl shadow-md">
          <GraduationCap className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
        </div>
        <div>
          <h2 className="text-lg lg:text-xl font-bold text-gray-900">
            Trilha de Capacitação
          </h2>
          <p className="text-sm text-gray-500">{activeCourse.course.title}</p>
        </div>
      </div>

      {/* Course Selector (multi-course) */}
      {hasMultipleCourses && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {courseIds.map((courseId) => {
            const courseMat = coursesMaterials[courseId];
            const isActive = courseId === activeCourseId;
            return (
              <button
                key={courseId}
                onClick={() => setSelectedCourseId(courseId)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                  isActive
                    ? 'bg-white border-brand-400 text-brand-900 shadow-sm'
                    : 'bg-brand-50/50 border-brand-200 text-brand-700 hover:bg-white hover:border-brand-300'
                }`}
              >
                <span className="line-clamp-1">
                  {courseMat.course.title.split('(')[0].trim()}
                </span>
                <span className="text-xs opacity-70 ml-1">{courseMat.docs.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Desktop Trail (lg+) */}
      <div className="hidden lg:block">
        {/* Trail Row */}
        <div className="relative flex items-start justify-center gap-0">
          {/* Connecting line */}
          {visibleSteps.length > 1 && (
            <div className="absolute top-8 left-0 right-0 flex items-center justify-center pointer-events-none">
              <div
                className="h-1 rounded-full bg-gradient-to-r from-brand-200 via-blue-200 to-green-200"
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
                className="relative flex flex-col items-center flex-1 cursor-pointer group"
                onClick={() => handleStepClick(step.id)}
              >
                {/* Circle */}
                <div
                  className={`relative z-10 w-16 h-16 rounded-full bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-lg transition-all duration-200 ${
                    isExpanded
                      ? 'ring-4 ring-offset-2 ring-brand-300 scale-110'
                      : 'group-hover:scale-105 group-hover:shadow-xl'
                  }`}
                >
                  <Icon className="w-7 h-7 text-white" />
                  {/* Step number badge */}
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-700">{index + 1}</span>
                  </div>
                </div>

                {/* Title + Subtitle */}
                <div className="mt-3 text-center">
                  <p
                    className={`text-sm font-bold transition-colors ${
                      isExpanded ? step.textColor : 'text-gray-800 group-hover:text-gray-900'
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{step.subtitle}</p>
                  <p className={`text-xs font-semibold mt-1 ${step.textColor}`}>
                    {docs.length} {docs.length === 1 ? 'material' : 'materiais'}
                  </p>
                </div>

                {/* Triangle indicator when expanded */}
                {isExpanded && (
                  <div className="mt-3 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[10px] border-b-gray-100" />
                )}
              </div>
            );
          })}
        </div>

        {/* Expanded Panel (full width below trail) */}
        {expandedStepData && expandedDocs.length > 0 && (
          <div
            className={`mt-2 rounded-2xl border ${expandedStepData.borderColor} ${expandedStepData.bgLight} p-5 transition-all`}
          >
            <div className="flex items-center gap-2 mb-4">
              <expandedStepData.icon
                className={`w-5 h-5 ${expandedStepData.textColor}`}
              />
              <h3 className={`font-bold ${expandedStepData.textColor}`}>
                {expandedStepData.title}
              </h3>
              <span
                className={`${expandedStepData.bgLight} ${expandedStepData.textColor} border ${expandedStepData.borderColor} px-2 py-0.5 rounded-full text-xs font-bold`}
              >
                {expandedDocs.length}
              </span>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
              {expandedDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDocumentClick(doc);
                  }}
                  className="w-full text-left bg-white hover:bg-gray-50 rounded-xl p-3.5 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group/card flex items-center gap-3"
                >
                  <div
                    className={`w-9 h-9 rounded-lg bg-gradient-to-br ${expandedStepData.gradient} flex items-center justify-center flex-shrink-0`}
                  >
                    <expandedStepData.icon className="w-4 h-4 text-white" />
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
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover/card:text-brand-500 flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Trail (< lg) */}
      <div className="lg:hidden space-y-0">
        {visibleSteps.map((step, index) => {
          const Icon = step.icon;
          const docs = getDocsForStep(step.category);
          const isExpanded = expandedStep === step.id;
          const isLast = index === visibleSteps.length - 1;

          return (
            <div key={step.id} className="relative">
              {/* Dashed vertical line connecting steps */}
              {!isLast && (
                <div className="absolute left-6 top-12 bottom-0 w-px border-l-2 border-dashed border-gray-200 z-0" />
              )}

              {/* Step row */}
              <button
                onClick={() => handleStepClick(step.id)}
                className="relative z-10 w-full flex items-center gap-3 py-3 text-left"
              >
                {/* Circle */}
                <div
                  className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-md flex-shrink-0 transition-all ${
                    isExpanded ? 'ring-3 ring-offset-1 ring-brand-300' : ''
                  }`}
                >
                  <Icon className="w-5 h-5 text-white" />
                  <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center">
                    <span className="text-[10px] font-bold text-gray-700">{index + 1}</span>
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-bold ${
                      isExpanded ? step.textColor : 'text-gray-800'
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-400">{step.subtitle}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${step.textColor}`}>
                    {docs.length} {docs.length === 1 ? 'material' : 'materiais'}
                  </p>
                </div>

                {/* Expand indicator */}
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Expanded documents (inline, pushes content down) */}
              {isExpanded && docs.length > 0 && (
                <div className="relative z-10 ml-6 pl-6 pb-3 space-y-2">
                  {docs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => onDocumentClick(doc)}
                      className={`w-full text-left ${step.bgLight} rounded-xl p-3 border ${step.borderColor} hover:shadow-sm transition-all group/card flex items-center gap-3`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg bg-gradient-to-br ${step.gradient} flex items-center justify-center flex-shrink-0`}
                      >
                        <Icon className="w-3.5 h-3.5 text-white" />
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
    </div>
  );
}
