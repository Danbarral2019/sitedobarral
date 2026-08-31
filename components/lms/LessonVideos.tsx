'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import HostedVideoPlayer from '@/components/lms/HostedVideoPlayer';

interface LessonVideoData {
  id: string;
  title: string;
  description?: string | null;
  displayOrder: number;
  isRequired: boolean;
  storageType: 'youtube' | 'r2';
  courseVideoId?: string | null;
  youtubeId?: string | null;
}

interface LessonVideosProps {
  videos: LessonVideoData[];
}

export default function LessonVideos({ videos }: LessonVideosProps) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  if (videos.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-bold text-ink-primary mb-4">Videos</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {videos.map((video) => (
          <div key={video.id} className="bg-white border border-border-subtle rounded-[6px] overflow-hidden">
            <div className="relative aspect-video bg-brand-900">
              {video.storageType === 'r2' && video.courseVideoId ? (
                <HostedVideoPlayer videoId={video.courseVideoId} title={video.title} />
              ) : activeVideoId === video.id ? (
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                    <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform border border-border-subtle">
                      <Play className="w-6 h-6 text-ink-primary ml-0.5" />
                    </div>
                  </div>
                </button>
              )}
            </div>
            <div className="p-3">
              <h4 className="text-sm font-semibold text-ink-primary line-clamp-1">{video.title}</h4>
              {video.description && (
                <p className="text-xs text-ink-muted line-clamp-2 mt-0.5">{video.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
