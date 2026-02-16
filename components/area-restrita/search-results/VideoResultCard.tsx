import { Video, Play } from 'lucide-react';
import type { VideoResult } from '@/lib/types/global-search';
import { highlightText } from './search-utils';

export interface VideoResultCardProps {
  video: VideoResult;
  query: string;
}

export function VideoResultCard({ video, query }: VideoResultCardProps) {
  return (
    <a
      href={video.youtubeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] overflow-hidden hover:border-red-300 hover:shadow-md transition-all group"
    >
      <div className="flex">
        {/* Thumbnail */}
        <div className="relative w-32 h-20 bg-[var(--bg-tertiary)] flex-shrink-0">
          {video.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-red-100">
              <Video className="w-8 h-8 text-red-500" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-8 h-8 text-white" />
          </div>
        </div>
        {/* Content */}
        <div className="p-3 flex-1 min-w-0">
          <h4 className="font-semibold text-[var(--text-primary)] text-sm line-clamp-1 group-hover:text-red-600 transition-colors">
            {highlightText(video.title, query)}
          </h4>
          {video.description && (
            <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{video.description}</p>
          )}
          {video.courseName && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
              {video.courseName}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
