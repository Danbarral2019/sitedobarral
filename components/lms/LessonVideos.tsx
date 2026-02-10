'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';

interface LessonVideoData {
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeId: string;
  description?: string | null;
  displayOrder: number;
  isRequired: boolean;
}

interface LessonVideosProps {
  videos: LessonVideoData[];
}

export default function LessonVideos({ videos }: LessonVideosProps) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  if (videos.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-4">Videos</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {videos.map((video) => {
          const isPlaying = activeVideoId === video.id;
          const thumbnailUrl = `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`;

          return (
            <div key={video.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="relative aspect-video bg-gray-900">
                {isPlaying ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                    loading="lazy"
                  />
                ) : (
                  <button
                    onClick={() => setActiveVideoId(video.id)}
                    className="absolute inset-0 w-full h-full group cursor-pointer"
                  >
                    <img
                      src={thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                      <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 text-gray-900 ml-0.5" />
                      </div>
                    </div>
                  </button>
                )}
              </div>
              <div className="p-3">
                <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">{video.title}</h4>
                {video.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{video.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
