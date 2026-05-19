'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { parseLeiArticles } from '@/lib/lei-articles';
import { extractYoutubeId } from '@/lib/admin/lesson-youtube';

export interface LessonDocumentData {
  id: string;
  documentId: string;
  displayOrder: number;
  isRequired: boolean;
  note: string | null;
  document: {
    id: string;
    title: string;
    category: string;
    type: string;
  };
}

export interface LessonVideoData {
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeId: string;
  description: string | null;
  displayOrder: number;
  isRequired: boolean;
}

export interface LessonData {
  id: string;
  moduleId: string;
  title: string;
  slug: string;
  description: string | null;
  content: string | null;
  displayOrder: number;
  isPublished: boolean;
  estimatedMinutes: number | null;
  leiArticles: string | null;
  module: {
    id: string;
    title: string;
  };
  documents: LessonDocumentData[];
  videos: LessonVideoData[];
}

export interface SearchableDoc {
  id: string;
  title: string;
  category: string;
  type: string;
}

export type LessonTabId = 'conteudo' | 'documentos' | 'videos' | 'configuracoes';

export interface SettingsFormState {
  title: string;
  slug: string;
  description: string;
  estimatedMinutes: string;
  isPublished: boolean;
  leiArticles: string;
}

const EMPTY_SETTINGS: SettingsFormState = {
  title: '',
  slug: '',
  description: '',
  estimatedMinutes: '',
  isPublished: false,
  leiArticles: '',
};

export function useLessonEditor(courseId: string, lessonId: string) {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [activeTab, setActiveTab] = useState<LessonTabId>('conteudo');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [content, setContent] = useState('');

  const [showDocSearch, setShowDocSearch] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [allDocs, setAllDocs] = useState<SearchableDoc[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  const [showVideoForm, setShowVideoForm] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const [settingsForm, setSettingsForm] = useState<SettingsFormState>(EMPTY_SETTINGS);

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

  const loadLesson = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/lessons/${lessonId}`);
      if (!res.ok) return;
      const data = await res.json();
      const l: LessonData = data.lesson;
      setLesson(l);
      setContent(l.content || '');
      const articles = parseLeiArticles(l.leiArticles).join(', ');
      setSettingsForm({
        title: l.title,
        slug: l.slug,
        description: l.description || '',
        estimatedMinutes: l.estimatedMinutes?.toString() || '',
        isPublished: l.isPublished,
        leiArticles: articles,
      });
    } catch {
      // silently fail
    }
  }, [lessonId]);

  useEffect(() => {
    verifyAdmin();
    loadLesson();
  }, [verifyAdmin, loadLesson]);

  const showTransientMessage = useCallback((message: string) => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(''), 3000);
  }, []);

  // ---- Content Tab ----

  const handleSaveContent = useCallback(async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch(`/api/admin/lessons/${lessonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        showTransientMessage('Conteudo salvo com sucesso!');
      }
    } catch {
      setSaveMessage('Erro ao salvar.');
    } finally {
      setIsSaving(false);
    }
  }, [lessonId, content, showTransientMessage]);

  // ---- Documents Tab ----

  const loadAllDocs = useCallback(async () => {
    if (allDocs.length > 0) return;
    setIsLoadingDocs(true);
    try {
      const res = await fetch(`/api/documents?courseId=${courseId}&limit=500`);
      if (!res.ok) return;
      const data = await res.json();
      setAllDocs(
        (data.documents || []).map((d: SearchableDoc) => ({
          id: d.id,
          title: d.title,
          category: d.category,
          type: d.type,
        })),
      );
    } catch {
      // silently fail
    } finally {
      setIsLoadingDocs(false);
    }
  }, [courseId, allDocs.length]);

  const filteredDocs = useMemo(() => {
    if (!docSearchQuery.trim()) return allDocs.slice(0, 20);
    const q = docSearchQuery.toLowerCase();
    return allDocs.filter((d) => d.title.toLowerCase().includes(q)).slice(0, 20);
  }, [allDocs, docSearchQuery]);

  const linkedDocIds = useMemo(
    () => new Set(lesson?.documents.map((d) => d.documentId) || []),
    [lesson?.documents],
  );

  const handleToggleDocSearch = useCallback(() => {
    setShowDocSearch((prev) => {
      const next = !prev;
      if (next) loadAllDocs();
      return next;
    });
  }, [loadAllDocs]);

  const handleLinkDocument = useCallback(
    async (docId: string) => {
      try {
        await fetch(`/api/admin/lessons/${lessonId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: docId }),
        });
        await loadLesson();
      } catch {
        // silently fail
      }
    },
    [lessonId, loadLesson],
  );

  const handleUnlinkDocument = useCallback(
    async (lessonDocId: string) => {
      try {
        await fetch(`/api/admin/lessons/${lessonId}/documents/${lessonDocId}`, {
          method: 'DELETE',
        });
        await loadLesson();
      } catch {
        // silently fail
      }
    },
    [lessonId, loadLesson],
  );

  const handleToggleDocRequired = useCallback(
    async (lessonDoc: LessonDocumentData) => {
      try {
        await fetch(`/api/admin/lessons/${lessonId}/documents/${lessonDoc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRequired: !lessonDoc.isRequired }),
        });
        await loadLesson();
      } catch {
        // silently fail
      }
    },
    [lessonId, loadLesson],
  );

  // ---- Videos Tab ----

  const handleAddVideo = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const ytId = extractYoutubeId(videoUrl);
      if (!ytId) return;
      setIsSaving(true);
      try {
        await fetch(`/api/admin/lessons/${lessonId}/videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: videoTitle,
            youtubeUrl: videoUrl,
            youtubeId: ytId,
          }),
        });
        setShowVideoForm(false);
        setVideoTitle('');
        setVideoUrl('');
        await loadLesson();
      } catch {
        // silently fail
      } finally {
        setIsSaving(false);
      }
    },
    [videoUrl, videoTitle, lessonId, loadLesson],
  );

  const handleRemoveVideo = useCallback(
    async (videoId: string) => {
      try {
        await fetch(`/api/admin/lessons/${lessonId}/videos/${videoId}`, {
          method: 'DELETE',
        });
        await loadLesson();
      } catch {
        // silently fail
      }
    },
    [lessonId, loadLesson],
  );

  const handleCancelVideoForm = useCallback(() => {
    setShowVideoForm(false);
    setVideoTitle('');
    setVideoUrl('');
  }, []);

  // ---- Settings Tab ----

  const setSettingsField = useCallback(
    <K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) => {
      setSettingsForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSaveSettings = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      setSaveMessage('');
      try {
        const articlesArr = settingsForm.leiArticles
          ? settingsForm.leiArticles.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
        const res = await fetch(`/api/admin/lessons/${lessonId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: settingsForm.title,
            slug: settingsForm.slug,
            description: settingsForm.description || null,
            estimatedMinutes: settingsForm.estimatedMinutes ? parseInt(settingsForm.estimatedMinutes) : null,
            isPublished: settingsForm.isPublished,
            leiArticles: JSON.stringify(articlesArr),
          }),
        });
        if (res.ok) {
          setSaveMessage('Configuracoes salvas!');
          await loadLesson();
          setTimeout(() => setSaveMessage(''), 3000);
        }
      } catch {
        setSaveMessage('Erro ao salvar.');
      } finally {
        setIsSaving(false);
      }
    },
    [settingsForm, lessonId, loadLesson],
  );

  return {
    // Loading
    isLoading,
    lesson,
    isSaving,
    saveMessage,

    // Tabs
    activeTab,
    setActiveTab,

    // Content
    content,
    setContent,
    handleSaveContent,

    // Documents
    showDocSearch,
    handleToggleDocSearch,
    docSearchQuery,
    setDocSearchQuery,
    filteredDocs,
    linkedDocIds,
    isLoadingDocs,
    handleLinkDocument,
    handleUnlinkDocument,
    handleToggleDocRequired,

    // Videos
    showVideoForm,
    setShowVideoForm,
    videoTitle,
    setVideoTitle,
    videoUrl,
    setVideoUrl,
    handleAddVideo,
    handleRemoveVideo,
    handleCancelVideoForm,

    // Settings
    settingsForm,
    setSettingsField,
    handleSaveSettings,
  };
}
