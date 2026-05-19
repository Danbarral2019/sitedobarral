'use client';

import { Loader2 } from 'lucide-react';
import { getCourseById } from '@/lib/courses';
import AdminLayout from '@/components/AdminLayout';
import { useLessonEditor } from '@/hooks/use-lesson-editor';
import { LessonEditorHeader } from '@/components/admin/lms/lesson-editor/LessonEditorHeader';
import { LessonEditorTabs } from '@/components/admin/lms/lesson-editor/LessonEditorTabs';
import { LessonContentTab } from '@/components/admin/lms/lesson-editor/LessonContentTab';
import { LessonDocumentsTab } from '@/components/admin/lms/lesson-editor/LessonDocumentsTab';
import { LessonVideosTab } from '@/components/admin/lms/lesson-editor/LessonVideosTab';
import { LessonSettingsTab } from '@/components/admin/lms/lesson-editor/LessonSettingsTab';

export default function LessonEditorClient({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const course = getCourseById(courseId);
  const editor = useLessonEditor(courseId, lessonId);

  if (editor.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  if (!course || !editor.lesson) {
    return (
      <AdminLayout>
        <div className="p-8">
          <p className="text-gray-600">{!course ? 'Curso nao encontrado.' : 'Licao nao encontrada.'}</p>
        </div>
      </AdminLayout>
    );
  }

  const { lesson } = editor;
  const quizLink = `/admin/lms/${courseId}/lessons/${lessonId}/quiz`;

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <LessonEditorHeader
            courseId={courseId}
            courseTitle={course.title}
            lessonTitle={lesson.title}
            moduleTitle={lesson.module?.title}
            isPublished={lesson.isPublished}
          />

          <LessonEditorTabs
            activeTab={editor.activeTab}
            onChange={editor.setActiveTab}
            quizLink={quizLink}
          />

          {editor.saveMessage && (
            <div
              className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${
                editor.saveMessage.includes('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
              }`}
            >
              {editor.saveMessage}
            </div>
          )}

          {editor.activeTab === 'conteudo' && (
            <LessonContentTab
              content={editor.content}
              onChange={editor.setContent}
              onSave={editor.handleSaveContent}
              isSaving={editor.isSaving}
            />
          )}

          {editor.activeTab === 'documentos' && (
            <LessonDocumentsTab
              linkedDocuments={lesson.documents}
              showSearch={editor.showDocSearch}
              onToggleSearch={editor.handleToggleDocSearch}
              searchQuery={editor.docSearchQuery}
              onSearchChange={editor.setDocSearchQuery}
              filteredDocs={editor.filteredDocs}
              linkedDocIds={editor.linkedDocIds}
              isLoadingDocs={editor.isLoadingDocs}
              onLink={editor.handleLinkDocument}
              onUnlink={editor.handleUnlinkDocument}
              onToggleRequired={editor.handleToggleDocRequired}
            />
          )}

          {editor.activeTab === 'videos' && (
            <LessonVideosTab
              videos={lesson.videos}
              showForm={editor.showVideoForm}
              onToggleForm={editor.setShowVideoForm}
              videoTitle={editor.videoTitle}
              onVideoTitleChange={editor.setVideoTitle}
              videoUrl={editor.videoUrl}
              onVideoUrlChange={editor.setVideoUrl}
              onAdd={editor.handleAddVideo}
              onRemove={editor.handleRemoveVideo}
              onCancel={editor.handleCancelVideoForm}
              isSaving={editor.isSaving}
            />
          )}

          {editor.activeTab === 'configuracoes' && (
            <LessonSettingsTab
              form={editor.settingsForm}
              onFieldChange={editor.setSettingsField}
              onSubmit={editor.handleSaveSettings}
              isSaving={editor.isSaving}
            />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
