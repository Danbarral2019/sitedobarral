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
 className="block bg-surface-page rounded-md border border-border-subtle overflow-hidden hover:border-border-strong transition-all group"
 >
 <div className="flex">
 {/* Thumbnail */}
 <div className="relative w-32 h-20 bg-surface-deep flex-shrink-0">
 {video.thumbnailUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={video.thumbnailUrl}
 alt={video.title}
 className="w-full h-full object-cover"
 />
 ) : (
 <div className="w-full h-full flex items-center justify-center bg-surface-deep">
 <Video className="w-8 h-8 text-semantic-error" />
 </div>
 )}
 <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
 <Play className="w-8 h-8 text-surface-page" />
 </div>
 </div>
 {/* Content */}
 <div className="p-3 flex-1 min-w-0">
 <h4 className="font-semibold text-ink-primary text-sm line-clamp-1 group-hover:text-semantic-error transition-colors">
 {highlightText(video.title, query)}
 </h4>
 {video.description && (
 <p className="text-xs text-ink-muted mt-1 line-clamp-2">{video.description}</p>
 )}
 {video.courseName && (
 <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-surface-raised text-semantic-error">
 {video.courseName}
 </span>
 )}
 </div>
 </div>
 </a>
 );
}
