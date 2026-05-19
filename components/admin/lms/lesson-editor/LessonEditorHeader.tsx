'use client';

import Link from 'next/link';
import { BookOpen, ChevronRight } from 'lucide-react';

interface LessonEditorHeaderProps {
  courseId: string;
  courseTitle: string;
  lessonTitle: string;
  moduleTitle?: string;
  isPublished: boolean;
}

export function LessonEditorHeader({
  courseId,
  courseTitle,
  lessonTitle,
  moduleTitle,
  isPublished,
}: LessonEditorHeaderProps) {
  const truncatedCourse = courseTitle.length > 30 ? courseTitle.substring(0, 30) + '...' : courseTitle;

  return (
    <>
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
        <Link href="/admin" className="hover:text-gray-700">Admin</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/admin/lms" className="hover:text-gray-700">LMS</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href={`/admin/lms/${courseId}`} className="hover:text-gray-700">
          {truncatedCourse}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 font-medium">{lessonTitle}</span>
      </nav>

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">{lessonTitle}</h1>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isPublished ? 'Publicado' : 'Rascunho'}
          </span>
        </div>
        {moduleTitle && (
          <p className="text-sm text-gray-500 mt-1">Modulo: {moduleTitle}</p>
        )}
      </div>
    </>
  );
}
