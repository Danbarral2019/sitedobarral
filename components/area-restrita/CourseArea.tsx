'use client';

import { useState, useMemo } from 'react';
import {
  FileText,
  BookOpen,
  Library,
  Download,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Paperclip,
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

const CATEGORY_CONFIG: Record<string, {
  label: string;
  icon: typeof FileText;
  color: string;
  borderColor: string;
  bgColor: string;
  gradient: string;
}> = {
  'apostila': {
    label: 'Apostilas',
    icon: BookOpen,
    color: 'text-purple-600',
    borderColor: 'border-purple-200',
    bgColor: 'bg-purple-50',
    gradient: 'from-purple-500 to-purple-700',
  },
  'conteudo-programatico': {
    label: 'Conteúdo Programático',
    icon: FileText,
    color: 'text-blue-600',
    borderColor: 'border-blue-200',
    bgColor: 'bg-blue-50',
    gradient: 'from-blue-500 to-blue-700',
  },
  'bibliografia': {
    label: 'Bibliografia',
    icon: Library,
    color: 'text-green-600',
    borderColor: 'border-green-200',
    bgColor: 'bg-green-50',
    gradient: 'from-green-500 to-green-700',
  },
  'material-complementar': {
    label: 'Material Complementar',
    icon: Paperclip,
    color: 'text-orange-600',
    borderColor: 'border-orange-200',
    bgColor: 'bg-orange-50',
    gradient: 'from-orange-500 to-orange-700',
  },
};

const COURSE_MATERIAL_CATEGORIES = ['apostila', 'conteudo-programatico', 'bibliografia', 'material-complementar'];

function CategorySection({
  category,
  docs,
  onDocumentClick,
  defaultExpanded = true,
}: {
  category: string;
  docs: Document[];
  onDocumentClick: (doc: Document) => void;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const config = CATEGORY_CONFIG[category] || {
    label: category,
    icon: FileText,
    color: 'text-gray-600',
    borderColor: 'border-gray-200',
    bgColor: 'bg-gray-50',
    gradient: 'from-gray-500 to-gray-700',
  };
  const Icon = config.icon;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors group"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <span className="font-semibold text-gray-900 text-sm">{config.label}</span>
        <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          {docs.length}
        </span>
      </button>

      {isExpanded && (
        <div className="grid gap-2 mt-2 ml-8">
          {docs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => onDocumentClick(doc)}
              className={`w-full text-left bg-white rounded-xl p-3 border ${config.borderColor} hover:shadow-md transition-all group/card flex items-center gap-3`}
            >
              <div className={`w-10 h-10 bg-gradient-to-br ${config.gradient} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-gray-900 line-clamp-1 group-hover/card:text-brand-600 transition-colors">
                  {doc.title}
                </h4>
                {doc.description && (
                  <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{doc.description}</p>
                )}
              </div>
              <Download className="w-4 h-4 text-gray-300 group-hover/card:text-brand-600 flex-shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CourseArea({
  documents,
  enrolledCourseIds,
  onDocumentClick,
}: CourseAreaProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    enrolledCourseIds.length === 1 ? enrolledCourseIds[0] : null
  );

  // Get course materials grouped by course
  const coursesMaterials = useMemo(() => {
    const result: Record<string, { course: typeof courses[0]; docs: Document[] }> = {};

    enrolledCourseIds.forEach((courseId) => {
      const course = courses.find((c) => c.id === courseId);
      if (!course) return;

      const courseDocs = documents[courseId] || [];
      // Also include common documents (no courseId)
      const commonDocs = Object.values(documents)
        .flat()
        .filter((d) => d.isCommon && COURSE_MATERIAL_CATEGORIES.includes(d.category));

      const allDocs = [...courseDocs, ...commonDocs]
        .filter((d) => COURSE_MATERIAL_CATEGORIES.includes(d.category))
        // Deduplicate by id
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

  if (!activeCourse || activeCourse.docs.length === 0) {
    return null;
  }

  // Group docs by category
  const docsByCategory = COURSE_MATERIAL_CATEGORIES
    .map((cat) => ({
      category: cat,
      docs: activeCourse.docs.filter((d) => d.category === cat),
    }))
    .filter((group) => group.docs.length > 0);

  const totalDocs = activeCourse.docs.length;

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-lg border-2 border-amber-200 mb-6 overflow-hidden">
      {/* Header */}
      <div className="p-4 lg:p-6 pb-0 lg:pb-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-md">
            <GraduationCap className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
          </div>
          <div>
            <h2 className="text-base lg:text-xl font-bold text-gray-900">Seu Curso</h2>
            <p className="text-xs lg:text-sm text-gray-600">
              {activeCourse.course.title}
            </p>
          </div>
          <span className="ml-auto px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            {totalDocs} {totalDocs === 1 ? 'material' : 'materiais'}
          </span>
        </div>
      </div>

      {/* Course Selector (multi-curso) */}
      {hasMultipleCourses && (
        <div className="px-4 lg:px-6 pt-3">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {courseIds.map((courseId) => {
              const courseMat = coursesMaterials[courseId];
              const isActive = courseId === activeCourseId;
              return (
                <button
                  key={courseId}
                  onClick={() => setSelectedCourseId(courseId)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                    isActive
                      ? 'bg-white border-amber-400 text-amber-900 shadow-sm'
                      : 'bg-amber-50/50 border-amber-200 text-amber-700 hover:bg-white hover:border-amber-300'
                  }`}
                >
                  <span className="line-clamp-1">{courseMat.course.title.split('(')[0].trim()}</span>
                  <span className="text-xs opacity-70 ml-1">{courseMat.docs.length}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Materials by Category */}
      <div className="p-4 lg:p-6 pt-3 lg:pt-4">
        {docsByCategory.map((group) => (
          <CategorySection
            key={group.category}
            category={group.category}
            docs={group.docs}
            onDocumentClick={onDocumentClick}
          />
        ))}
      </div>

      {/* Tip */}
      <div className="mx-4 lg:mx-6 mb-4 lg:mb-6 p-3 bg-amber-100 border border-amber-300 rounded-lg">
        <p className="text-xs lg:text-sm text-amber-900 font-medium leading-relaxed">
          Clique nos materiais para visualizar detalhes e fazer o download.
        </p>
      </div>
    </div>
  );
}
