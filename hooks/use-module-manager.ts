'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { slugify } from '@/lib/admin/lms/slug';

export interface LessonData {
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

export interface ModuleData {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  displayOrder: number;
  isPublished: boolean;
  lessons: LessonData[];
}

export interface ModuleFormData {
  title: string;
  description: string;
}

export interface LessonFormData {
  title: string;
  slug: string;
  description: string;
  prerequisiteId: string;
}

export type DeleteTarget = { type: 'module' | 'lesson'; id: string; title: string };

export interface BulkPreviewItem {
  title: string;
  slug: string;
  description: string;
  estimatedMinutes: number | null;
}

export function useModuleManager(courseId: string) {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleData | null>(null);
  const [moduleForm, setModuleForm] = useState<ModuleFormData>({ title: '', description: '' });

  const [showLessonModal, setShowLessonModal] = useState(false);
  const [lessonModuleId, setLessonModuleId] = useState<string>('');
  const [editingLesson, setEditingLesson] = useState<LessonData | null>(null);
  const [lessonForm, setLessonForm] = useState<LessonFormData>({
    title: '',
    slug: '',
    description: '',
    prerequisiteId: '',
  });

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkModuleId, setBulkModuleId] = useState('');
  const [bulkJsonInput, setBulkJsonInput] = useState('');
  const [bulkPreview, setBulkPreview] = useState<BulkPreviewItem[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const verifyAdmin = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify');
      if (!response.ok) {
        router.push('/validar-acesso');
        return;
      }
      const data = await response.json();
      if (data.user.role !== 'admin') {
        router.push('/area-restrita');
        return;
      }
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

  const toggleModule = useCallback((id: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ---- Drag and drop ----

  const handleModuleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const sorted = [...modules].sort((a, b) => a.displayOrder - b.displayOrder);
      const oldIndex = sorted.findIndex((m) => `module-${m.id}` === active.id);
      const newIndex = sorted.findIndex((m) => `module-${m.id}` === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(sorted, oldIndex, newIndex);
      setModules(reordered.map((m, i) => ({ ...m, displayOrder: i })));
      try {
        await fetch('/api/admin/modules/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, moduleIds: reordered.map((m) => m.id) }),
        });
        await loadModules();
      } catch {
        await loadModules();
      }
    },
    [modules, courseId, loadModules],
  );

  const handleLessonDragEnd = useCallback(
    async (moduleId: string, event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const mod = modules.find((m) => m.id === moduleId);
      if (!mod) return;
      const sorted = [...mod.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
      const oldIndex = sorted.findIndex((l) => `lesson-${l.id}` === active.id);
      const newIndex = sorted.findIndex((l) => `lesson-${l.id}` === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(sorted, oldIndex, newIndex);
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? { ...m, lessons: reordered.map((l, i) => ({ ...l, displayOrder: i })) }
            : m,
        ),
      );
      try {
        await fetch('/api/admin/lessons/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleId, lessonIds: reordered.map((l) => l.id) }),
        });
        await loadModules();
      } catch {
        await loadModules();
      }
    },
    [modules, loadModules],
  );

  // ---- Module CRUD ----

  const openCreateModule = useCallback(() => {
    setEditingModule(null);
    setModuleForm({ title: '', description: '' });
    setShowModuleModal(true);
  }, []);

  const openEditModule = useCallback((mod: ModuleData) => {
    setEditingModule(mod);
    setModuleForm({ title: mod.title, description: mod.description || '' });
    setShowModuleModal(true);
  }, []);

  const handleSaveModule = useCallback(
    async (e: React.FormEvent) => {
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
    },
    [editingModule, moduleForm, courseId, loadModules],
  );

  const toggleModulePublish = useCallback(
    async (mod: ModuleData) => {
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
    },
    [loadModules],
  );

  const moveModule = useCallback(
    async (mod: ModuleData, direction: 'up' | 'down') => {
      const sorted = [...modules].sort((a, b) => a.displayOrder - b.displayOrder);
      const idx = sorted.findIndex((m) => m.id === mod.id);
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
    },
    [modules, courseId, loadModules],
  );

  // ---- Lesson CRUD ----

  const openCreateLesson = useCallback((moduleId: string) => {
    setEditingLesson(null);
    setLessonModuleId(moduleId);
    setLessonForm({ title: '', slug: '', description: '', prerequisiteId: '' });
    setShowLessonModal(true);
  }, []);

  const openEditLesson = useCallback((lesson: LessonData, moduleId: string) => {
    setEditingLesson(lesson);
    setLessonModuleId(moduleId);
    setLessonForm({
      title: lesson.title,
      slug: lesson.slug,
      description: lesson.description || '',
      prerequisiteId: lesson.prerequisiteId || '',
    });
    setShowLessonModal(true);
  }, []);

  const handleSaveLesson = useCallback(
    async (e: React.FormEvent) => {
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
    },
    [editingLesson, lessonForm, lessonModuleId, loadModules],
  );

  const toggleLessonPublish = useCallback(
    async (lesson: LessonData) => {
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
    },
    [loadModules],
  );

  const moveLesson = useCallback(
    async (lesson: LessonData, moduleId: string, direction: 'up' | 'down') => {
      const mod = modules.find((m) => m.id === moduleId);
      if (!mod) return;
      const sorted = [...mod.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
      const idx = sorted.findIndex((l) => l.id === lesson.id);
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
    },
    [modules, loadModules],
  );

  // ---- Delete ----

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const endpoint =
        deleteTarget.type === 'module'
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
  }, [deleteTarget, loadModules]);

  // ---- Bulk import ----

  const openBulkImport = useCallback((moduleId: string) => {
    setBulkModuleId(moduleId);
    setBulkJsonInput('');
    setBulkPreview([]);
    setBulkError('');
    setShowBulkImportModal(true);
  }, []);

  const validateBulkJson = useCallback(() => {
    try {
      const parsed = JSON.parse(bulkJsonInput);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setBulkError('JSON deve ser um array com pelo menos 1 item.');
        return;
      }
      const preview = parsed.map(
        (item: { title?: string; description?: string; estimatedMinutes?: number }) => {
          if (!item.title || typeof item.title !== 'string') {
            throw new Error(`Item sem titulo valido: ${JSON.stringify(item)}`);
          }
          return {
            title: item.title,
            slug: slugify(item.title),
            description: item.description || '',
            estimatedMinutes: typeof item.estimatedMinutes === 'number' ? item.estimatedMinutes : null,
          };
        },
      );
      setBulkPreview(preview);
      setBulkError('');
    } catch (err) {
      setBulkError(
        err instanceof SyntaxError ? 'JSON invalido. Verifique a sintaxe.' : (err as Error).message,
      );
      setBulkPreview([]);
    }
  }, [bulkJsonInput]);

  const confirmBulkImport = useCallback(async () => {
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
  }, [bulkPreview, bulkModuleId, loadModules]);

  return {
    // Loading / data
    isLoading,
    modules,
    sortedModules: [...modules].sort((a, b) => a.displayOrder - b.displayOrder),

    // Expansion
    expandedModules,
    toggleModule,

    // DnD
    sensors,
    handleModuleDragEnd,
    handleLessonDragEnd,

    // Module modal
    showModuleModal,
    setShowModuleModal,
    editingModule,
    moduleForm,
    setModuleForm,
    openCreateModule,
    openEditModule,
    handleSaveModule,
    isSaving,

    // Module actions
    toggleModulePublish,
    moveModule,

    // Lesson modal
    showLessonModal,
    setShowLessonModal,
    editingLesson,
    lessonForm,
    setLessonForm,
    openCreateLesson,
    openEditLesson,
    handleSaveLesson,

    // Lesson actions
    toggleLessonPublish,
    moveLesson,

    // Delete
    deleteTarget,
    setDeleteTarget,
    handleDelete,
    isDeleting,

    // Bulk import
    showBulkImportModal,
    setShowBulkImportModal,
    bulkJsonInput,
    setBulkJsonInput,
    bulkPreview,
    bulkError,
    bulkImporting,
    openBulkImport,
    validateBulkJson,
    confirmBulkImport,
  };
}
