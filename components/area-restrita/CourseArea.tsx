'use client';

import { useState, useMemo } from 'react';
import {
  FileText,
  BookOpen,
  Library,
  Download,
  ChevronDown,
  ChevronUp,
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
  gradient: string;
  iconBg: string;
  iconText: string;
  badgeBg: string;
  badgeText: string;
}> = {
  'apostila': {
    label: 'Apostilas',
    icon: BookOpen,
    gradient: 'from-purple-500/10 via-purple-400/5 to-transparent',
    iconBg: 'bg-purple-100',
    iconText: 'text-purple-600',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
  },
  'conteudo-programatico': {
    label: 'Conteudo Programatico',
    icon: FileText,
    gradient: 'from-blue-500/10 via-blue-400/5 to-transparent',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
  },
  'bibliografia': {
    label: 'Bibliografia',
    icon: Library,
    gradient: 'from-green-500/10 via-green-400/5 to-transparent',
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
  },
  'material-complementar': {
    label: 'Material Complementar',
    icon: Paperclip,
    gradient: 'from-orange-500/10 via-orange-400/5 to-transparent',
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-600',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
  },
};

const COURSE_MATERIAL_CATEGORIES = ['apostila', 'conteudo-programatico', 'bibliografia', 'material-complementar'];

const defaultCategoryConfig = {
  label: 'Outros',
  icon: FileText,
  gradient: 'from-gray-500/10 via-gray-400/5 to-transparent',
  iconBg: 'bg-gray-100',
  iconText: 'text-gray-600',
  badgeBg: 'bg-gray-100',
  badgeText: 'text-gray-700',
};

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
  const config = CATEGORY_CONFIG[category] || defaultCategoryConfig;
  const Icon = config.icon;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden transition-shadow hover:shadow-lg">
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-4 bg-gradient-to-r ${config.gradient} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${config.iconBg} ${config.iconText} rounded-lg flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-gray-900 text-sm lg:text-base">{config.label}</h3>
          <span className={`${config.badgeBg} ${config.badgeText} px-2.5 py-0.5 rounded-full text-xs font-bold`}>
            {docs.length}
          </span>
        </div>
        <div className="text-gray-400">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </button>

      {/* Documents */}
      {isExpanded && (
        <div className="p-3 lg:p-4 space-y-2.5">
          {docs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => onDocumentClick(doc)}
              className="w-full text-left bg-gray-50 hover:bg-white rounded-xl p-3 lg:p-4 border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all group flex items-center gap-3"
            >
              <div className={`w-9 h-9 ${config.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${config.iconText}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                  {doc.title}
                </h4>
                {doc.description && (
                  <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{doc.description}</p>
                )}
              </div>
              <Download className="w-4 h-4 text-gray-300 group-hover:text-blue-600 flex-shrink-0 transition-colors" />
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

  const coursesMaterials = useMemo(() => {
    const result: Record<string, { course: typeof courses[0]; docs: Document[] }> = {};

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

  if (!activeCourse || activeCourse.docs.length === 0) {
    return null;
  }

  const docsByCategory = COURSE_MATERIAL_CATEGORIES
    .map((cat) => ({
      category: cat,
      docs: activeCourse.docs.filter((d) => d.category === cat),
    }))
    .filter((group) => group.docs.length > 0);

  const totalDocs = activeCourse.docs.length;

  return (
    <div className="mb-6 space-y-4">
      {/* Course Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-md">
          <GraduationCap className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
        </div>
        <div>
          <h2 className="text-lg lg:text-xl font-bold text-gray-900">Seu Curso</h2>
          <p className="text-sm text-gray-500">
            {activeCourse.course.title}
          </p>
        </div>
        <span className="ml-auto px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
          {totalDocs} {totalDocs === 1 ? 'material' : 'materiais'}
        </span>
      </div>

      {/* Course Selector (multi-curso) */}
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
      )}

      {/* Materials by Category - same card style as DocumentsByCategory */}
      {docsByCategory.map((group) => (
        <CategorySection
          key={group.category}
          category={group.category}
          docs={group.docs}
          onDocumentClick={onDocumentClick}
        />
      ))}
    </div>
  );
}
