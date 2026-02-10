'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  GraduationCap, BookOpen, FileText, Play, Settings, Plus, Trash2, Save,
  Link as LinkIcon, Unlink, Eye, EyeOff, Loader2, ChevronRight, X, Search, ClipboardCheck
} from 'lucide-react';
import { getCourseById } from '@/lib/courses';
import AdminLayout from '@/components/AdminLayout';

interface LessonDocumentData {
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

interface LessonVideoData {
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeId: string;
  description: string | null;
  displayOrder: number;
  isRequired: boolean;
}

interface LessonData {
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

interface SearchableDoc {
  id: string;
  title: string;
  category: string;
  type: string;
}

type TabId = 'conteudo' | 'documentos' | 'videos' | 'configuracoes';

export default function LessonEditorClient({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const router = useRouter();
  const course = getCourseById(courseId);

  const [isLoading, setIsLoading] = useState(true);
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('conteudo');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Content tab
  const [content, setContent] = useState('');

  // Documents tab
  const [showDocSearch, setShowDocSearch] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [allDocs, setAllDocs] = useState<SearchableDoc[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // Videos tab
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // Settings tab
  const [settingsForm, setSettingsForm] = useState({
    title: '',
    slug: '',
    description: '',
    estimatedMinutes: '',
    isPublished: false,
    leiArticles: '',
  });

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
      const l = data.lesson;
      setLesson(l);
      setContent(l.content || '');
      let articles = '';
      if (l.leiArticles) {
        try {
          const arr = JSON.parse(l.leiArticles);
          articles = Array.isArray(arr) ? arr.join(', ') : l.leiArticles;
        } catch {
          articles = l.leiArticles;
        }
      }
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

  // ---- Content Tab ----

  const handleSaveContent = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch(`/api/admin/lessons/${lessonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setSaveMessage('Conteudo salvo com sucesso!');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch {
      setSaveMessage('Erro ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  const simpleMarkdownToHtml = (md: string): string => {
    let html = md;
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>');
    // Bold and italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>');
    html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="list-disc my-2">$&</ul>');
    // Line breaks
    html = html.replace(/\n/g, '<br/>');
    return html;
  };

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
        }))
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
    return allDocs.filter(d => d.title.toLowerCase().includes(q)).slice(0, 20);
  }, [allDocs, docSearchQuery]);

  const linkedDocIds = useMemo(
    () => new Set(lesson?.documents.map(d => d.documentId) || []),
    [lesson?.documents]
  );

  const handleLinkDocument = async (docId: string) => {
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
  };

  const handleUnlinkDocument = async (lessonDocId: string) => {
    try {
      await fetch(`/api/admin/lessons/${lessonId}/documents/${lessonDocId}`, {
        method: 'DELETE',
      });
      await loadLesson();
    } catch {
      // silently fail
    }
  };

  const handleToggleDocRequired = async (lessonDoc: LessonDocumentData) => {
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
  };

  // ---- Videos Tab ----

  const extractYoutubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const p of patterns) {
      const match = url.match(p);
      if (match) return match[1];
    }
    return null;
  };

  const handleAddVideo = async (e: React.FormEvent) => {
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
  };

  const handleRemoveVideo = async (videoId: string) => {
    try {
      await fetch(`/api/admin/lessons/${lessonId}/videos/${videoId}`, {
        method: 'DELETE',
      });
      await loadLesson();
    } catch {
      // silently fail
    }
  };

  // ---- Settings Tab ----

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage('');
    try {
      const articlesArr = settingsForm.leiArticles
        ? settingsForm.leiArticles.split(',').map(s => s.trim()).filter(Boolean)
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
  };

  // ---- Render ----

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  if (!course || !lesson) {
    return (
      <AdminLayout>
        <div className="p-8">
          <p className="text-gray-600">{!course ? 'Curso nao encontrado.' : 'Licao nao encontrada.'}</p>
        </div>
      </AdminLayout>
    );
  }

  const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
    { id: 'conteudo', label: 'Conteudo', icon: FileText },
    { id: 'documentos', label: 'Documentos', icon: LinkIcon },
    { id: 'videos', label: 'Videos', icon: Play },
    { id: 'configuracoes', label: 'Configuracoes', icon: Settings },
  ];

  const quizLink = `/admin/lms/${courseId}/lessons/${lessonId}/quiz`;

  const categoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      apostila: 'Apostila', acordao: 'Acordao', parecer: 'Parecer',
      edital: 'Edital', artigo: 'Artigo', 'orientacao-normativa': 'ON',
      decor: 'DECOR', enunciado: 'Enunciado', 'manual-tcu': 'Manual TCU', outro: 'Outro',
    };
    return map[cat] || cat;
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
            <Link href="/admin" className="hover:text-gray-700">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin/lms" className="hover:text-gray-700">LMS</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/admin/lms/${courseId}`} className="hover:text-gray-700">
              {course.title.length > 30 ? course.title.substring(0, 30) + '...' : course.title}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 font-medium">{lesson.title}</span>
          </nav>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">{lesson.title}</h1>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                lesson.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {lesson.isPublished ? 'Publicado' : 'Rascunho'}
              </span>
            </div>
            {lesson.module && (
              <p className="text-sm text-gray-500 mt-1">Modulo: {lesson.module.title}</p>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-gray-200 mb-6">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
            {/* Quiz link (external page) */}
            <Link
              href={quizLink}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-transparent text-purple-600 hover:text-purple-700 hover:border-purple-300 transition-colors"
            >
              <ClipboardCheck className="w-4 h-4" />
              Quiz
            </Link>
          </div>

          {/* Save message */}
          {saveMessage && (
            <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${
              saveMessage.includes('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}>
              {saveMessage}
            </div>
          )}

          {/* === Tab: Conteudo === */}
          {activeTab === 'conteudo' && (
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Editor */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Editor (Markdown)</h3>
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    rows={24}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 font-mono text-sm resize-y"
                    placeholder="# Titulo da Licao&#10;&#10;Escreva o conteudo aqui em Markdown...&#10;&#10;## Subtitulo&#10;&#10;- Item 1&#10;- Item 2&#10;&#10;**Texto em negrito** e *italico*"
                  />
                </div>

                {/* Preview */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Preview</h3>
                  <div
                    className="prose prose-sm max-w-none text-gray-800 min-h-[400px] p-3 bg-gray-50 rounded-lg border border-gray-100"
                    dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(content) }}
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveContent}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Conteudo
                </button>
              </div>
            </div>
          )}

          {/* === Tab: Documentos === */}
          {activeTab === 'documentos' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Documentos Vinculados</h3>
                <button
                  onClick={() => {
                    setShowDocSearch(!showDocSearch);
                    if (!showDocSearch) loadAllDocs();
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <LinkIcon className="w-4 h-4" />
                  Vincular Documento
                </button>
              </div>

              {/* Linked documents list */}
              {lesson.documents.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  Nenhum documento vinculado
                </div>
              ) : (
                <div className="space-y-2 mb-6">
                  {lesson.documents
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map(ld => (
                    <div key={ld.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{ld.document.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                            {categoryLabel(ld.document.category)}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {ld.document.type}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleDocRequired(ld)}
                        className={`text-xs px-2 py-1 rounded font-medium ${
                          ld.isRequired
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {ld.isRequired ? 'Obrigatorio' : 'Opcional'}
                      </button>
                      <button
                        onClick={() => handleUnlinkDocument(ld.id)}
                        className="p-1.5 hover:bg-red-50 rounded transition-colors"
                        title="Desvincular"
                      >
                        <Unlink className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Document search */}
              {showDocSearch && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="relative mb-3">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={docSearchQuery}
                      onChange={e => setDocSearchQuery(e.target.value)}
                      placeholder="Buscar documentos..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                      autoFocus
                    />
                  </div>
                  {isLoadingDocs ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {filteredDocs.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">Nenhum documento encontrado</p>
                      ) : (
                        filteredDocs.map(doc => {
                          const isLinked = linkedDocIds.has(doc.id);
                          return (
                            <div
                              key={doc.id}
                              className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                                isLinked ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="flex-1 truncate text-gray-900">{doc.title}</span>
                              <span className="text-xs text-gray-500">{categoryLabel(doc.category)}</span>
                              {isLinked ? (
                                <span className="text-xs text-green-600 font-medium">Vinculado</span>
                              ) : (
                                <button
                                  onClick={() => handleLinkDocument(doc.id)}
                                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
                                >
                                  Vincular
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* === Tab: Videos === */}
          {activeTab === 'videos' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Videos</h3>
                <button
                  onClick={() => setShowVideoForm(!showVideoForm)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Video
                </button>
              </div>

              {/* Video list */}
              {lesson.videos.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <Play className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  Nenhum video vinculado
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {lesson.videos
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map(video => (
                    <div key={video.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <img
                        src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                        alt={video.title}
                        className="w-32 h-18 object-cover rounded flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{video.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 font-mono">{video.youtubeId}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveVideo(video.id)}
                        className="p-1.5 hover:bg-red-50 rounded transition-colors"
                        title="Remover video"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add video form */}
              {showVideoForm && (
                <div className="border-t border-gray-200 pt-4">
                  <form onSubmit={handleAddVideo} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">URL do YouTube</label>
                      <input
                        type="text"
                        value={videoUrl}
                        onChange={e => setVideoUrl(e.target.value)}
                        required
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                      />
                      {videoUrl && extractYoutubeId(videoUrl) && (
                        <div className="mt-2">
                          <img
                            src={`https://img.youtube.com/vi/${extractYoutubeId(videoUrl)}/mqdefault.jpg`}
                            alt="Thumbnail"
                            className="w-40 rounded border"
                          />
                        </div>
                      )}
                      {videoUrl && !extractYoutubeId(videoUrl) && (
                        <p className="text-xs text-red-500 mt-1">URL do YouTube invalida</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Titulo</label>
                      <input
                        type="text"
                        value={videoTitle}
                        onChange={e => setVideoTitle(e.target.value)}
                        required
                        placeholder="Titulo do video"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setShowVideoForm(false); setVideoTitle(''); setVideoUrl(''); }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving || !extractYoutubeId(videoUrl)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Adicionar
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* === Tab: Configuracoes === */}
          {activeTab === 'configuracoes' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <form onSubmit={handleSaveSettings} className="space-y-5 max-w-2xl">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Titulo</label>
                  <input
                    type="text"
                    value={settingsForm.title}
                    onChange={e => setSettingsForm({ ...settingsForm, title: e.target.value })}
                    required
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Slug</label>
                  <input
                    type="text"
                    value={settingsForm.slug}
                    onChange={e => setSettingsForm({ ...settingsForm, slug: e.target.value })}
                    required
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Descricao</label>
                  <textarea
                    value={settingsForm.description}
                    onChange={e => setSettingsForm({ ...settingsForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                    placeholder="Descricao da licao..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Tempo estimado (minutos)</label>
                  <input
                    type="number"
                    value={settingsForm.estimatedMinutes}
                    onChange={e => setSettingsForm({ ...settingsForm, estimatedMinutes: e.target.value })}
                    min="0"
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                    placeholder="Ex: 30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Artigos da Lei 14.133 (separados por virgula)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.leiArticles}
                    onChange={e => setSettingsForm({ ...settingsForm, leiArticles: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                    placeholder="Ex: 6, 75, 92, 147"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold text-gray-900">Publicado</label>
                  <button
                    type="button"
                    onClick={() => setSettingsForm({ ...settingsForm, isPublished: !settingsForm.isPublished })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      settingsForm.isPublished ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      settingsForm.isPublished ? 'translate-x-5' : ''
                    }`} />
                  </button>
                  <span className="text-sm text-gray-600">
                    {settingsForm.isPublished ? (
                      <span className="flex items-center gap-1"><Eye className="w-4 h-4 text-green-600" /> Visivel para alunos</span>
                    ) : (
                      <span className="flex items-center gap-1"><EyeOff className="w-4 h-4 text-gray-400" /> Oculto</span>
                    )}
                  </span>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar Configuracoes
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
