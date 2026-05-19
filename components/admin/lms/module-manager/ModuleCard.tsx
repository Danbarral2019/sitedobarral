'use client';

import {
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Plus,
  Upload,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableLessonItem } from './SortableLessonItem';
import { LessonRow } from './LessonRow';
import type { ModuleData, LessonData } from '@/hooks/use-module-manager';

interface ModuleCardProps {
  mod: ModuleData;
  courseId: string;
  index: number;
  totalModules: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTogglePublish: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreateLesson: () => void;
  onBulkImport: () => void;
  onLessonDragEnd: (e: DragEndEvent) => void;
  onLessonMoveUp: (lesson: LessonData) => void;
  onLessonMoveDown: (lesson: LessonData) => void;
  onLessonTogglePublish: (lesson: LessonData) => void;
  onLessonEditMeta: (lesson: LessonData) => void;
  onLessonDelete: (lesson: LessonData) => void;
  sensors: ReturnType<typeof import('@dnd-kit/core').useSensors>;
}

export function ModuleCard({
  mod,
  courseId,
  index,
  totalModules,
  isExpanded,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onTogglePublish,
  onEdit,
  onDelete,
  onCreateLesson,
  onBulkImport,
  onLessonDragEnd,
  onLessonMoveUp,
  onLessonMoveDown,
  onLessonTogglePublish,
  onLessonEditMeta,
  onLessonDelete,
  sensors,
}: ModuleCardProps) {
  const sortedLessons = [...mod.lessons].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        <button onClick={onToggleExpand} className="p-1 hover:bg-gray-100 rounded transition-colors">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
        </button>

        <div className="flex-1 cursor-pointer" onClick={onToggleExpand}>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{mod.title}</h3>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                mod.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {mod.isPublished ? 'Publicado' : 'Rascunho'}
            </span>
            <span className="text-xs text-gray-500">
              {sortedLessons.length} {sortedLessons.length === 1 ? 'licao' : 'licoes'}
            </span>
          </div>
          {mod.description && <p className="text-sm text-gray-500 mt-0.5">{mod.description}</p>}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-30"
            title="Mover para cima"
          >
            <ArrowUp className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalModules - 1}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-30"
            title="Mover para baixo"
          >
            <ArrowDown className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={onTogglePublish}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title={mod.isPublished ? 'Despublicar' : 'Publicar'}
          >
            {mod.isPublished ? (
              <Eye className="w-4 h-4 text-green-600" />
            ) : (
              <EyeOff className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Editar modulo">
            <Pencil className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded transition-colors" title="Excluir modulo">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-gray-50">
          {sortedLessons.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">Nenhuma licao neste modulo</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onLessonDragEnd}>
              <SortableContext
                items={sortedLessons.map((l) => `lesson-${l.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="divide-y divide-gray-100">
                  {sortedLessons.map((lesson, lessonIdx) => (
                    <SortableLessonItem key={lesson.id} id={`lesson-${lesson.id}`}>
                      <LessonRow
                        lesson={lesson}
                        moduleId={mod.id}
                        courseId={courseId}
                        index={lessonIdx}
                        totalLessons={sortedLessons.length}
                        onMoveUp={() => onLessonMoveUp(lesson)}
                        onMoveDown={() => onLessonMoveDown(lesson)}
                        onTogglePublish={() => onLessonTogglePublish(lesson)}
                        onEditMeta={() => onLessonEditMeta(lesson)}
                        onDelete={() => onLessonDelete(lesson)}
                      />
                    </SortableLessonItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <div className="p-3 border-t border-gray-200 flex items-center gap-2">
            <button
              onClick={onCreateLesson}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Licao
            </button>
            <button
              onClick={onBulkImport}
              className="flex items-center gap-2 text-sm text-green-600 hover:text-green-800 font-medium px-3 py-1.5 hover:bg-green-50 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Importar Aulas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
