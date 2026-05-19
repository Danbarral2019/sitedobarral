'use client';

import { Layers, Plus, Loader2 } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { getCourseById } from '@/lib/courses';
import AdminLayout from '@/components/AdminLayout';
import { useModuleManager } from '@/hooks/use-module-manager';
import { ModuleManagerHeader } from '@/components/admin/lms/module-manager/ModuleManagerHeader';
import { SortableModuleItem } from '@/components/admin/lms/module-manager/SortableModuleItem';
import { ModuleCard } from '@/components/admin/lms/module-manager/ModuleCard';
import { ModuleFormModal } from '@/components/admin/lms/module-manager/ModuleFormModal';
import { LessonFormModal } from '@/components/admin/lms/module-manager/LessonFormModal';
import { BulkImportModal } from '@/components/admin/lms/module-manager/BulkImportModal';
import { DeleteConfirmationModal } from '@/components/admin/lms/module-manager/DeleteConfirmationModal';

export default function ModuleManagerClient({ courseId }: { courseId: string }) {
  const course = getCourseById(courseId);
  const m = useModuleManager(courseId);

  if (m.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  if (!course) {
    return (
      <AdminLayout>
        <div className="p-8">
          <p className="text-gray-600">Curso nao encontrado.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <ModuleManagerHeader
            courseTitle={course.title}
            modulesCount={m.sortedModules.length}
            onCreateModule={m.openCreateModule}
          />

          {m.sortedModules.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Nenhum modulo criado ainda</p>
              <button
                onClick={m.openCreateModule}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Criar Primeiro Modulo
              </button>
            </div>
          ) : (
            <DndContext sensors={m.sensors} collisionDetection={closestCenter} onDragEnd={m.handleModuleDragEnd}>
              <SortableContext
                items={m.sortedModules.map((mod) => `module-${mod.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {m.sortedModules.map((mod, modIdx) => (
                    <SortableModuleItem key={mod.id} id={`module-${mod.id}`}>
                      <ModuleCard
                        mod={mod}
                        courseId={courseId}
                        index={modIdx}
                        totalModules={m.sortedModules.length}
                        isExpanded={m.expandedModules.has(mod.id)}
                        onToggleExpand={() => m.toggleModule(mod.id)}
                        onMoveUp={() => m.moveModule(mod, 'up')}
                        onMoveDown={() => m.moveModule(mod, 'down')}
                        onTogglePublish={() => m.toggleModulePublish(mod)}
                        onEdit={() => m.openEditModule(mod)}
                        onDelete={() => m.setDeleteTarget({ type: 'module', id: mod.id, title: mod.title })}
                        onCreateLesson={() => m.openCreateLesson(mod.id)}
                        onBulkImport={() => m.openBulkImport(mod.id)}
                        onLessonDragEnd={(e) => m.handleLessonDragEnd(mod.id, e)}
                        onLessonMoveUp={(lesson) => m.moveLesson(lesson, mod.id, 'up')}
                        onLessonMoveDown={(lesson) => m.moveLesson(lesson, mod.id, 'down')}
                        onLessonTogglePublish={(lesson) => m.toggleLessonPublish(lesson)}
                        onLessonEditMeta={(lesson) => m.openEditLesson(lesson, mod.id)}
                        onLessonDelete={(lesson) => m.setDeleteTarget({ type: 'lesson', id: lesson.id, title: lesson.title })}
                        sensors={m.sensors}
                      />
                    </SortableModuleItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      <ModuleFormModal
        open={m.showModuleModal}
        editing={m.editingModule}
        form={m.moduleForm}
        onChange={m.setModuleForm}
        onClose={() => m.setShowModuleModal(false)}
        onSubmit={m.handleSaveModule}
        isSaving={m.isSaving}
      />

      <LessonFormModal
        open={m.showLessonModal}
        editing={m.editingLesson}
        form={m.lessonForm}
        onChange={m.setLessonForm}
        modules={m.modules}
        onClose={() => m.setShowLessonModal(false)}
        onSubmit={m.handleSaveLesson}
        isSaving={m.isSaving}
      />

      <BulkImportModal
        open={m.showBulkImportModal}
        jsonInput={m.bulkJsonInput}
        onJsonChange={m.setBulkJsonInput}
        preview={m.bulkPreview}
        error={m.bulkError}
        importing={m.bulkImporting}
        onClose={() => m.setShowBulkImportModal(false)}
        onValidate={m.validateBulkJson}
        onConfirm={m.confirmBulkImport}
      />

      <DeleteConfirmationModal
        target={m.deleteTarget}
        onCancel={() => m.setDeleteTarget(null)}
        onConfirm={m.handleDelete}
        isDeleting={m.isDeleting}
      />
    </AdminLayout>
  );
}
