'use client';

import Link from 'next/link';
import {
  BookOpen,
  Clock,
  ClipboardCheck,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Pencil,
  Save,
  Trash2,
} from 'lucide-react';
import type { LessonData } from '@/hooks/use-module-manager';

interface LessonRowProps {
  lesson: LessonData;
  moduleId: string;
  courseId: string;
  index: number;
  totalLessons: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTogglePublish: () => void;
  onEditMeta: () => void;
  onDelete: () => void;
}

export function LessonRow({
  lesson,
  moduleId,
  courseId,
  index,
  totalLessons,
  onMoveUp,
  onMoveDown,
  onTogglePublish,
  onEditMeta,
  onDelete,
}: LessonRowProps) {
  // moduleId not used in render but kept in props for callsite clarity
  void moduleId;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors">
      <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">{lesson.title}</span>
          <span
            className={`px-1.5 py-0.5 text-xs font-medium rounded ${
              lesson.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {lesson.isPublished ? 'Pub' : 'Rasc'}
          </span>
          {lesson.estimatedMinutes && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              {lesson.estimatedMinutes}min
            </span>
          )}
          {lesson.hasQuiz && (
            <span className="flex items-center gap-0.5 text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
              <ClipboardCheck className="w-3 h-3" />
              Quiz
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">/{lesson.slug}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-30"
          title="Mover para cima"
        >
          <ArrowUp className="w-3.5 h-3.5 text-gray-500" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === totalLessons - 1}
          className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-30"
          title="Mover para baixo"
        >
          <ArrowDown className="w-3.5 h-3.5 text-gray-500" />
        </button>
        <button
          onClick={onTogglePublish}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title={lesson.isPublished ? 'Despublicar' : 'Publicar'}
        >
          {lesson.isPublished ? (
            <Eye className="w-3.5 h-3.5 text-green-600" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 text-gray-400" />
          )}
        </button>
        <Link
          href={`/admin/lms/${courseId}/lessons/${lesson.id}`}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title="Editar licao"
        >
          <Pencil className="w-3.5 h-3.5 text-blue-600" />
        </Link>
        <button
          onClick={onEditMeta}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title="Editar titulo/slug"
        >
          <Save className="w-3.5 h-3.5 text-gray-500" />
        </button>
        <button
          onClick={onDelete}
          className="p-1 hover:bg-red-50 rounded transition-colors"
          title="Excluir licao"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </button>
      </div>
    </div>
  );
}
