'use client';

import { Play, Plus, Trash2, Loader2 } from 'lucide-react';
import { extractYoutubeId } from '@/lib/admin/lesson-youtube';
import type { LessonVideoData } from '@/hooks/use-lesson-editor';

interface LessonVideosTabProps {
  videos: LessonVideoData[];
  showForm: boolean;
  onToggleForm: (open: boolean) => void;
  videoTitle: string;
  onVideoTitleChange: (v: string) => void;
  videoUrl: string;
  onVideoUrlChange: (v: string) => void;
  onAdd: (e: React.FormEvent) => void;
  onRemove: (videoId: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function LessonVideosTab({
  videos,
  showForm,
  onToggleForm,
  videoTitle,
  onVideoTitleChange,
  videoUrl,
  onVideoUrlChange,
  onAdd,
  onRemove,
  onCancel,
  isSaving,
}: LessonVideosTabProps) {
  const sorted = [...videos].sort((a, b) => a.displayOrder - b.displayOrder);
  const previewYtId = videoUrl ? extractYoutubeId(videoUrl) : null;
  const isUrlInvalid = Boolean(videoUrl && !previewYtId);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Videos</h3>
        <button
          onClick={() => onToggleForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar Video
        </button>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          <Play className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          Nenhum video vinculado
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {sorted.map((video) => (
            <div key={video.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
                onClick={() => onRemove(video.id)}
                className="p-1.5 hover:bg-red-50 rounded transition-colors"
                title="Remover video"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="border-t border-gray-200 pt-4">
          <form onSubmit={onAdd} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL do YouTube</label>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => onVideoUrlChange(e.target.value)}
                required
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
              />
              {previewYtId && (
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${previewYtId}/mqdefault.jpg`}
                    alt="Thumbnail"
                    className="w-40 rounded border"
                  />
                </div>
              )}
              {isUrlInvalid && (
                <p className="text-xs text-red-500 mt-1">URL do YouTube invalida</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titulo</label>
              <input
                type="text"
                value={videoTitle}
                onChange={(e) => onVideoTitleChange(e.target.value)}
                required
                placeholder="Titulo do video"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || !previewYtId}
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
  );
}
