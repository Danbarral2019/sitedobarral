'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play, Youtube, ExternalLink } from 'lucide-react';
import HostedVideoPlayer from '@/components/lms/HostedVideoPlayer';

interface CourseVideo {
  id: string;
  title: string;
  description?: string | null;
  youtubeUrl?: string | null;
  youtubeId?: string | null;
  thumbnailUrl?: string | null;
  storageType?: 'youtube' | 'r2';
}

interface CourseVideosProps {
  videos: CourseVideo[];
  displayMode?: 'embedded' | 'thumbnails'; // Modo de exibição
}

export default function CourseVideos({ videos, displayMode = 'thumbnails' }: CourseVideosProps) {
  const [selectedVideo, setSelectedVideo] = useState<CourseVideo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!videos || videos.length === 0) {
    return null; // Não renderiza nada se não houver vídeos
  }

  // Função para obter URL da thumbnail do YouTube
  const getThumbnailUrl = (video: CourseVideo): string => {
    if (video.thumbnailUrl) return video.thumbnailUrl;
    if (video.youtubeId) return `https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`;
    return '';
  };

  // Função para obter URL de embed do YouTube
  const getEmbedUrl = (youtubeId: string): string => {
    return `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`;
  };

  // Handler para abrir modal
  const handleVideoClick = (video: CourseVideo) => {
    setSelectedVideo(video);
    setIsModalOpen(true);
  };

  // Handler para fechar modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedVideo(null);
  };

  return (
    <>
      <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl shadow-lg p-8 border-2 border-red-200 mt-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Youtube className="w-7 h-7 text-red-600" />
            Vídeos do Curso
          </h2>
          <p className="text-gray-700">
            Conteúdo audiovisual complementar para aprofundar seus conhecimentos
          </p>
        </div>

        {/* OPÇÃO 1: Thumbnails Clicáveis */}
        {displayMode === 'thumbnails' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <button
                key={video.id}
                onClick={() => handleVideoClick(video)}
                className="group relative overflow-hidden rounded-xl border-2 border-gray-300 hover:border-red-400 hover:shadow-lg transition-all bg-white"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gradient-to-br from-gray-200 to-gray-300 overflow-hidden">
                  <Image
                    src={getThumbnailUrl(video)}
                    alt={video.title}
                    width={640}
                    height={360}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    unoptimized
                  />
                  {/* Overlay com ícone de play */}
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                    <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                      <Play className="w-8 h-8 text-surface-page fill-white ml-1" />
                    </div>
                  </div>
                  {/* Badge do YouTube */}
                  <div className="absolute top-2 right-2 bg-red-600 text-surface-page px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                    <Youtube className="w-3 h-3" />
                    YouTube
                  </div>
                </div>

                {/* Informações */}
                <div className="p-4 text-left">
                  <h3 className="font-bold text-gray-900 group-hover:text-red-600 transition-colors line-clamp-2 mb-2">
                    {video.title}
                  </h3>
                  {video.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {video.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* OPÇÃO 2: Players Embedded */}
        {displayMode === 'embedded' && (
          <div className="space-y-6">
            {videos.map((video) => (
              <div
                key={video.id}
                className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Player */}
                <div className="relative aspect-video bg-black">
                  {video.storageType === 'r2' ? (
                    <HostedVideoPlayer videoId={video.id} title={video.title} />
                  ) : (
                    <iframe
                      src={getEmbedUrl(video.youtubeId ?? '')}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  )}
                </div>

                {/* Informações abaixo do player */}
                <div className="p-4 border-t-2 border-gray-200">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-bold text-gray-900 flex-1">
                      {video.title}
                    </h3>
                    {video.storageType !== 'r2' && video.youtubeUrl && (
                      <a
                        href={video.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium whitespace-nowrap"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Abrir no YouTube
                      </a>
                    )}
                  </div>
                  {video.description && (
                    <p className="text-sm text-gray-600">
                      {video.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-sm text-red-900 font-medium">
            🎥 <strong>Nota:</strong> {displayMode === 'thumbnails' ? 'Clique em qualquer vídeo para assistir em tela cheia.' : 'Os vídeos são carregados diretamente do YouTube.'}
          </p>
        </div>
      </div>

      {/* Modal para Vídeo (usado no modo thumbnails) */}
      {isModalOpen && selectedVideo && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="sticky top-0 bg-gradient-to-r from-red-600 to-pink-600 text-surface-page p-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Youtube className="w-6 h-6" />
                <h2 className="text-xl font-bold">{selectedVideo.title}</h2>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Fechar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Player */}
            <div className="relative aspect-video bg-black">
              {selectedVideo.storageType === 'r2' ? (
                <HostedVideoPlayer videoId={selectedVideo.id} title={selectedVideo.title} />
              ) : (
                <iframe
                  src={getEmbedUrl(selectedVideo.youtubeId ?? '')}
                  title={selectedVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              )}
            </div>

            {/* Informações */}
            <div className="p-6">
              {selectedVideo.description && (
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Descrição</h3>
                  <p className="text-gray-700 leading-relaxed">{selectedVideo.description}</p>
                </div>
              )}

              <div className="flex gap-3">
                {selectedVideo.storageType !== 'r2' && selectedVideo.youtubeUrl && (
                  <a
                    href={selectedVideo.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-red-600 text-surface-page px-6 py-3 rounded-xl font-bold hover:bg-semantic-error transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Abrir no YouTube
                  </a>
                )}
                <button
                  onClick={handleCloseModal}
                  className="px-6 py-3 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
