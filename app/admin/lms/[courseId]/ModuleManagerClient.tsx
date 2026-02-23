'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen, Layers, ChevronRight, ChevronDown,
  Plus, Trash2, Save, Eye, EyeOff, Loader2, X, ArrowUp, ArrowDown, Pencil, Clock, ClipboardCheck, GripVertical, Upload
} from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getCourseById } from '@/lib/courses';
import AdminLayout from '@/components/AdminLayout';

interface LessonData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  displayOrder: number;
  isPublished: boolean;
  estimatedMinutes: number | null;
  hasQuiz?: boolean;
  prerequisiteId?: string | null;
}

interface ModuleData {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  displayOrder: number;
  isPublished: boolean;
  lessons: LessonData[];
}

interface ModuleFormData {
  title: string;
  description: string;
}

interface LessonFormData {
  title: string;
  slug: string;
  description: string;
  prerequisiteId: string;
}

function SortableModuleItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : 'auto' as const,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div data-drag-handle {...listeners} className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing z-10" title="Arrastar para reordenar">
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>
      <div className="pl-8">
        {children}
      </div>
    </div>
  );
}

function SortableLessonItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : 'auto' as const,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div data-drag-handle {...listeners} className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 ml-2" title="Arrastar para reordenar">
        <GripVertical className="w-3.5 h-3.5 text-gray-400" />
      </div>
      <div className="pl-4">
        {children}
      </div>
    </div>
  );
}

export default function ModuleManagerClient({ courseId }: { courseId: string }) {
  const router = useRouter();
  const course = getCourseById(courseId);

  const [isLoading, setIsLoading] = useState(true);
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Module modal
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleData | null>(null);
  const [moduleForm, setModuleForm] = useState<ModuleFormData>({ title: '', description: '' });

  // Lesson modal
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [lessonModuleId, setLessonModuleId] = useState<string>('');
  const [editingLesson, setEditingLesson] = useState<LessonData | null>(null);
  const [lessonForm, setLessonForm] = useState<LessonFormData>({ title: '', slug: '', description: '', prerequisiteId: '' });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'module' | 'lesson'; id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk import
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkModuleId, setBulkModuleId] = useState('');
  const [bulkJsonInput, setBulkJsonInput] = useState('');
  const [bulkPreview, setBulkPreview] = useState<Array<{title: string; slug: string; description: string; estimatedMinutes: number | null}>>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkError, setBulkError] = useState('');

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleModuleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sorted = [...modules].sort((a, b) => a.displayOrder - b.displayOrder);
    const oldIndex = sorted.findIndex(m => `module-${m.id}` === active.id);
    const newIndex = sorted.findIndex(m => `module-${m.id}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    setModules(reordered.map((m, i) => ({ ...m, displayOrder: i })));
    try {
      await fetch('/api/admin/modules/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, moduleIds: reordered.map(m => m.id) }),
      });
      await loadModules();
    } catch {
      await loadModules();
    }
  };

  const handleLessonDragEnd = async (moduleId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return;
    const sorted = [...mod.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
    const oldIndex = sorted.findIndex(l => `lesson-${l.id}` === active.id);
    const newIndex = sorted.findIndex(l => `lesson-${l.id}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    setModules(prev => prev.map(m =>
      m.id === moduleId ? { ...m, lessons: reordered.map((l, i) => ({ ...l, displayOrder: i })) } : m
    ));
    try {
      await fetch('/api/admin/lessons/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, lessonIds: reordered.map(l => l.id) }),
      });
      await loadModules();
    } catch {
      await loadModules();
    }
  };

  const verifyAdmin = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify');
      if (!response.ok) { router.push('/validar-acesso'); return; }
      const data = await response.json();
      if (data.user.role !== 'admin') { router.push('/area-restrita'); return; }
    } catch {
      router.push('/validar-acesso');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const loadModules = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/modules?courseId=${courseId}`);
      if (!res.ok) return;
      const data = await res.json();
      setModules(data.modules || []);
    } catch {
      // silently fail
    }
  }, [courseId]);

  useEffect(() => {
    verifyAdmin();
    loadModules();
  }, [verifyAdmin, loadModules]);

  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ---- Module CRUD ----

  const openCreateModule = () => {
    setEditingModule(null);
    setModuleForm({ title: '', description: '' });
    setShowModuleModal(true);
  };

  const openEditModule = (mod: ModuleData) => {
    setEditingModule(mod);
    setModuleForm({ title: mod.title, description: mod.description || '' });
    setShowModuleModal(true);
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingModule) {
        await fetch(`/api/admin/modules/${editingModule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: moduleForm.title, description: moduleForm.description || null }),
        });
      } else {
        await fetch('/api/admin/modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, title: moduleForm.title, description: moduleForm.description || null }),
        });
      }
      setShowModuleModal(false);
      await loadModules();
    } catch {
      // silently fail
    } finally {
      setIsSaving(false);
    }
  };

  const toggleModulePublish = async (mod: ModuleData) => {
    try {
      await fetch(`/api/admin/modules/${mod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !mod.isPublished }),
      });
      await loadModules();
    } catch {
      // silently fail
    }
  };

  const moveModule = async (mod: ModuleData, direction: 'up' | 'down') => {
    const sorted = [...modules].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sorted.findIndex(m => m.id === mod.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    try {
      await fetch('/api/admin/modules/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          moduleIds: sorted.map((m, i) => {
            if (i === idx) return sorted[swapIdx].id;
            if (i === swapIdx) return sorted[idx].id;
            return m.id;
          }),
        }),
      });
      await loadModules();
    } catch {
      // silently fail
    }
  };

  // ---- Lesson CRUD ----

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const openCreateLesson = (moduleId: string) => {
    setEditingLesson(null);
    setLessonModuleId(moduleId);
    setLessonForm({ title: '', slug: '', description: '', prerequisiteId: '' });
    setShowLessonModal(true);
  };

  const openEditLesson = (lesson: LessonData, moduleId: string) => {
    setEditingLesson(lesson);
    setLessonModuleId(moduleId);
    setLessonForm({
      title: lesson.title,
      slug: lesson.slug,
      description: lesson.description || '',
      prerequisiteId: lesson.prerequisiteId || '',
    });
    setShowLessonModal(true);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const slug = lessonForm.slug || slugify(lessonForm.title);
      if (editingLesson) {
        await fetch(`/api/admin/lessons/${editingLesson.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: lessonForm.title,
            slug,
            description: lessonForm.description || null,
            prerequisiteId: lessonForm.prerequisiteId || null,
          }),
        });
      } else {
        await fetch('/api/admin/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            moduleId: lessonModuleId,
            title: lessonForm.title,
            slug,
            description: lessonForm.description || null,
            prerequisiteId: lessonForm.prerequisiteId || null,
          }),
        });
      }
      setShowLessonModal(false);
      await loadModules();
    } catch {
      // silently fail
    } finally {
      setIsSaving(false);
    }
  };

  const toggleLessonPublish = async (lesson: LessonData) => {
    try {
      await fetch(`/api/admin/lessons/${lesson.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !lesson.isPublished }),
      });
      await loadModules();
    } catch {
      // silently fail
    }
  };

  const moveLesson = async (lesson: LessonData, moduleId: string, direction: 'up' | 'down') => {
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return;
    const sorted = [...mod.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sorted.findIndex(l => l.id === lesson.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    try {
      await fetch('/api/admin/lessons/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId,
          lessonIds: sorted.map((l, i) => {
            if (i === idx) return sorted[swapIdx].id;
            if (i === swapIdx) return sorted[idx].id;
            return l.id;
          }),
        }),
      });
      await loadModules();
    } catch {
      // silently fail
    }
  };

  // ---- Delete ----

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const endpoint = deleteTarget.type === 'module'
        ? `/api/admin/modules/${deleteTarget.id}`
        : `/api/admin/lessons/${deleteTarget.id}`;
      await fetch(endpoint, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadModules();
    } catch {
      // silently fail
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
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

  const sortedModules = [...modules].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link href="/admin" className="hover:text-gray-700">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin/lms" className="hover:text-gray-700">LMS</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 font-medium">{course.title}</span>
          </nav>

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
              <p className="text-gray-600 mt-1">
                {sortedModules.length} {sortedModules.length === 1 ? 'modulo' : 'modulos'}
              </p>
            </div>
            <button
              onClick={openCreateModule}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Modulo
            </button>
          </div>

          {/* Modules list */}
          {sortedModules.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Nenhum modulo criado ainda</p>
              <button
                onClick={openCreateModule}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Criar Primeiro Modulo
              </button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
              <SortableContext items={sortedModules.map(m => `module-${m.id}`)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {sortedModules.map((mod, modIdx) => {
                    const isExpanded = expandedModules.has(mod.id);
                    const sortedLessons = [...mod.lessons].sort((a, b) => a.displayOrder - b.displayOrder);

                    return (
                      <SortableModuleItem key={mod.id} id={`module-${mod.id}`}>
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                          {/* Module header */}
                          <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                            <button
                              onClick={() => toggleModule(mod.id)}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-gray-500" />
                              )}
                            </button>

                            <div
                              className="flex-1 cursor-pointer"
                              onClick={() => toggleModule(mod.id)}
                            >
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900">{mod.title}</h3>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  mod.isPublished
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {mod.isPublished ? 'Publicado' : 'Rascunho'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {sortedLessons.length} {sortedLessons.length === 1 ? 'licao' : 'licoes'}
                                </span>
                              </div>
                              {mod.description && (
                                <p className="text-sm text-gray-500 mt-0.5">{mod.description}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => moveModule(mod, 'up')}
                                disabled={modIdx === 0}
                                className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-30"
                                title="Mover para cima"
                              >
                                <ArrowUp className="w-4 h-4 text-gray-500" />
                              </button>
                              <button
                                onClick={() => moveModule(mod, 'down')}
                                disabled={modIdx === sortedModules.length - 1}
                                className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-30"
                                title="Mover para baixo"
                              >
                                <ArrowDown className="w-4 h-4 text-gray-500" />
                              </button>
                              <button
                                onClick={() => toggleModulePublish(mod)}
                                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                title={mod.isPublished ? 'Despublicar' : 'Publicar'}
                              >
                                {mod.isPublished ? (
                                  <Eye className="w-4 h-4 text-green-600" />
                                ) : (
                                  <EyeOff className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                              <button
                                onClick={() => openEditModule(mod)}
                                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                title="Editar modulo"
                              >
                                <Pencil className="w-4 h-4 text-gray-500" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ type: 'module', id: mod.id, title: mod.title })}
                                className="p-1.5 hover:bg-red-50 rounded transition-colors"
                                title="Excluir modulo"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </div>

                          {/* Lessons (expanded) */}
                          {isExpanded && (
                            <div className="bg-gray-50">
                              {sortedLessons.length === 0 ? (
                                <div className="p-6 text-center text-gray-500 text-sm">
                                  Nenhuma licao neste modulo
                                </div>
                              ) : (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleLessonDragEnd(mod.id, e)}>
                                  <SortableContext items={sortedLessons.map(l => `lesson-${l.id}`)} strategy={verticalListSortingStrategy}>
                                    <div className="divide-y divide-gray-100">
                                      {sortedLessons.map((lesson, lessonIdx) => (
                                        <SortableLessonItem key={lesson.id} id={`lesson-${lesson.id}`}>
                                          <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors">
                                            <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-900 truncate">
                                                  {lesson.title}
                                                </span>
                                                <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                                                  lesson.isPublished
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-gray-200 text-gray-600'
                                                }`}>
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
                                                onClick={() => moveLesson(lesson, mod.id, 'up')}
                                                disabled={lessonIdx === 0}
                                                className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-30"
                                                title="Mover para cima"
                                              >
                                                <ArrowUp className="w-3.5 h-3.5 text-gray-500" />
                                              </button>
                                              <button
                                                onClick={() => moveLesson(lesson, mod.id, 'down')}
                                                disabled={lessonIdx === sortedLessons.length - 1}
                                                className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-30"
                                                title="Mover para baixo"
                                              >
                                                <ArrowDown className="w-3.5 h-3.5 text-gray-500" />
                                              </button>
                                              <button
                                                onClick={() => toggleLessonPublish(lesson)}
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
                                                onClick={() => openEditLesson(lesson, mod.id)}
                                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                title="Editar titulo/slug"
                                              >
                                                <Save className="w-3.5 h-3.5 text-gray-500" />
                                              </button>
                                              <button
                                                onClick={() => setDeleteTarget({ type: 'lesson', id: lesson.id, title: lesson.title })}
                                                className="p-1 hover:bg-red-50 rounded transition-colors"
                                                title="Excluir licao"
                                              >
                                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                              </button>
                                            </div>
                                          </div>
                                        </SortableLessonItem>
                                      ))}
                                    </div>
                                  </SortableContext>
                                </DndContext>
                              )}

                              <div className="p-3 border-t border-gray-200 flex items-center gap-2">
                                <button
                                  onClick={() => openCreateLesson(mod.id)}
                                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                  Nova Licao
                                </button>
                                <button
                                  onClick={() => {
                                    setBulkModuleId(mod.id);
                                    setBulkJsonInput('');
                                    setBulkPreview([]);
                                    setBulkError('');
                                    setShowBulkImportModal(true);
                                  }}
                                  className="flex items-center gap-2 text-sm text-green-600 hover:text-green-800 font-medium px-3 py-1.5 hover:bg-green-50 rounded-lg transition-colors"
                                >
                                  <Upload className="w-4 h-4" />
                                  Importar Aulas
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </SortableModuleItem>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Module Modal */}
      {showModuleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingModule ? 'Editar Modulo' : 'Novo Modulo'}
              </h3>
              <button onClick={() => setShowModuleModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveModule} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Titulo</label>
                <input
                  type="text"
                  value={moduleForm.title}
                  onChange={e => setModuleForm({ ...moduleForm, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                  placeholder="Ex: Modulo 1 - Introducao"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Descricao (opcional)</label>
                <textarea
                  value={moduleForm.description}
                  onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                  placeholder="Breve descricao do modulo..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModuleModal(false)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lesson Modal */}
      {showLessonModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingLesson ? 'Editar Licao' : 'Nova Licao'}
              </h3>
              <button onClick={() => setShowLessonModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveLesson} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Titulo</label>
                <input
                  type="text"
                  value={lessonForm.title}
                  onChange={e => {
                    const title = e.target.value;
                    setLessonForm({
                      ...lessonForm,
                      title,
                      slug: editingLesson ? lessonForm.slug : slugify(title),
                    });
                  }}
                  required
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                  placeholder="Ex: Introducao a Lei 14.133"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Slug</label>
                <input
                  type="text"
                  value={lessonForm.slug}
                  onChange={e => setLessonForm({ ...lessonForm, slug: e.target.value })}
                  required
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 font-mono text-sm"
                  placeholder="introducao-lei-14133"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Descricao (opcional)</label>
                <textarea
                  value={lessonForm.description}
                  onChange={e => setLessonForm({ ...lessonForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                  placeholder="Breve descricao da licao..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Pre-requisito (opcional)</label>
                <select
                  value={lessonForm.prerequisiteId}
                  onChange={e => setLessonForm({ ...lessonForm, prerequisiteId: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 text-sm"
                >
                  <option value="">Nenhum</option>
                  {modules.flatMap(mod =>
                    mod.lessons
                      .filter(l => l.id !== editingLesson?.id)
                      .map(l => (
                        <option key={l.id} value={l.id}>
                          {mod.title} &rarr; {l.title}
                        </option>
                      ))
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Aluno precisara completar esta aula antes de acessar a nova
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLessonModal(false)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold text-gray-900">Importar Aulas</h3>
              <button onClick={() => setShowBulkImportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">JSON (array de aulas)</label>
                <textarea
                  value={bulkJsonInput}
                  onChange={e => { setBulkJsonInput(e.target.value); setBulkError(''); }}
                  rows={6}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 font-mono text-sm"
                  placeholder={'[\n  { "title": "Aula 1", "description": "...", "estimatedMinutes": 30 },\n  { "title": "Aula 2", "description": "...", "estimatedMinutes": 45 }\n]'}
                />
              </div>

              {bulkError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{bulkError}</div>
              )}

              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(bulkJsonInput);
                    if (!Array.isArray(parsed) || parsed.length === 0) {
                      setBulkError('JSON deve ser um array com pelo menos 1 item.');
                      return;
                    }
                    const preview = parsed.map((item: { title?: string; description?: string; estimatedMinutes?: number }) => {
                      if (!item.title || typeof item.title !== 'string') {
                        throw new Error(`Item sem titulo valido: ${JSON.stringify(item)}`);
                      }
                      return {
                        title: item.title,
                        slug: slugify(item.title),
                        description: item.description || '',
                        estimatedMinutes: typeof item.estimatedMinutes === 'number' ? item.estimatedMinutes : null,
                      };
                    });
                    setBulkPreview(preview);
                    setBulkError('');
                  } catch (err) {
                    setBulkError(err instanceof SyntaxError ? 'JSON invalido. Verifique a sintaxe.' : (err as Error).message);
                    setBulkPreview([]);
                  }
                }}
                disabled={!bulkJsonInput.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Validar e Visualizar
              </button>

              {bulkPreview.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200 rounded-lg">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">Titulo</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">Slug</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">Descricao</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-700">Tempo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkPreview.map((item, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-2 px-3 text-gray-900">{item.title}</td>
                            <td className="py-2 px-3 text-gray-500 font-mono text-xs">{item.slug}</td>
                            <td className="py-2 px-3 text-gray-600 truncate max-w-[200px]">{item.description || '\u2014'}</td>
                            <td className="py-2 px-3 text-center text-gray-600">{item.estimatedMinutes ? `${item.estimatedMinutes}min` : '\u2014'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowBulkImportModal(false)}
                      className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        setBulkImporting(true);
                        setBulkError('');
                        try {
                          for (const item of bulkPreview) {
                            const res = await fetch('/api/admin/lessons', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                moduleId: bulkModuleId,
                                title: item.title,
                                slug: item.slug,
                                description: item.description || null,
                              }),
                            });
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}));
                              throw new Error(data.error || `Erro ao criar "${item.title}"`);
                            }
                          }
                          setShowBulkImportModal(false);
                          await loadModules();
                        } catch (err) {
                          setBulkError((err as Error).message);
                        } finally {
                          setBulkImporting(false);
                        }
                      }}
                      disabled={bulkImporting}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {bulkImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Confirmar Importacao ({bulkPreview.length} {bulkPreview.length === 1 ? 'aula' : 'aulas'})
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Excluir {deleteTarget.type === 'module' ? 'Modulo' : 'Licao'}
              </h3>
              <button onClick={() => setDeleteTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-gray-900">
                Tem certeza que deseja excluir <strong>{deleteTarget.title}</strong>?
              </p>
              {deleteTarget.type === 'module' && (
                <p className="text-sm text-red-600 mt-2">
                  Todas as licoes deste modulo tambem serao excluidas.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
