'use client';

/**
 * Configuração da lista de Vídeos
 *
 * NOTA: 'use client' aqui sinaliza que este arquivo contém lógica de cliente
 * e deve ser usado apenas em Client Components (VideosClient.tsx)
 */

import Image from 'next/image';
import { Youtube, ExternalLink, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { createListConfig } from '@/components/admin/ResourceListContainer';
import { AdminListConfig, FilterConfig } from '@/lib/types/admin-list';
import { CourseVideo } from '@/lib/videos';
import { courses } from '@/data/courses';

interface VideosConfigProps {
  courses: Array<{ id: string; title: string }>;
}

export function createVideosConfig({ courses: coursesList }: VideosConfigProps): AdminListConfig<CourseVideo> {
  const filters: FilterConfig[] = [
    {
      id: 'courseId',
      label: 'Curso',
      type: 'select',
      options: [
        { value: '', label: 'Todos os cursos' },
        ...coursesList.map(c => ({ value: c.id, label: c.title }))
      ],
    },
    {
      id: 'isActive',
      label: 'Status',
      type: 'select',
      options: [
        { value: '', label: 'Todos' },
        { value: 'true', label: 'Ativos' },
        { value: 'false', label: 'Inativos' },
      ],
    },
  ];

  return createListConfig<CourseVideo>({
    title: 'Vídeos do YouTube',
    description: 'Gerenciar vídeos dos cursos',

    showSearch: true,
    searchPlaceholder: 'Buscar por título ou descrição...',

    showStats: true,
    getStats: (items) => [
      {
        label: 'Total',
        value: items.length,
        icon: Youtube,
        color: 'bg-red-100 text-red-600',
      },
      {
        label: 'Ativos',
        value: items.filter((v) => v.isActive).length,
        icon: CheckCircle,
        color: 'bg-green-100 text-green-600',
      },
    ],

    filters,

    columns: [
      {
        id: 'thumbnail',
        label: 'Miniatura',
        render: (video) => (
          <div className="w-24 h-16 relative rounded overflow-hidden">
            {video.thumbnailUrl ? (
              <Image
                src={video.thumbnailUrl}
                alt={video.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <Youtube className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'title',
        label: 'Título',
        render: (video) => {
          const course = coursesList.find(c => c.id === video.courseId);
          return (
            <div>
              <p className="font-semibold text-gray-900">{video.title}</p>
              {video.description && (
                <p className="text-sm text-gray-600 line-clamp-1">{video.description}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">{course?.title || 'Curso desconhecido'}</p>
            </div>
          );
        },
      },
      {
        id: 'youtubeId',
        label: 'YouTube ID',
        render: (video) => (
          <p className="text-sm text-gray-700 font-mono">{video.youtubeId}</p>
        ),
      },
      {
        id: 'isActive',
        label: 'Status',
        render: (video) =>
          video.isActive ? (
            <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full flex items-center gap-1 w-fit">
              <CheckCircle className="w-3 h-3" />
              Ativo
            </span>
          ) : (
            <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded-full flex items-center gap-1 w-fit">
              <XCircle className="w-3 h-3" />
              Inativo
            </span>
          ),
      },
    ],

    rowActions: [
      {
        id: 'watch',
        label: 'Assistir no YouTube',
        icon: ExternalLink,
        color: 'text-red-600',
        action: (video) => {
          window.open(video.youtubeUrl, '_blank', 'noopener,noreferrer');
        },
      },
      {
        id: 'edit',
        label: 'Editar',
        icon: Edit,
        color: 'text-blue-600',
        action: (video) => {
          window.location.href = `/admin/videos/${video.id}/edit`;
        },
      },
      {
        id: 'delete',
        label: 'Deletar',
        icon: Trash2,
        color: 'text-red-600',
        action: async (video) => {
          if (!confirm(`Tem certeza que deseja deletar o vídeo "${video.title}"?`)) return;
          const response = await fetch(`/api/admin/videos/${video.id}`, {
            method: 'DELETE'
          });
          if (!response.ok) {
            throw new Error('Failed to delete video');
          }
        },
      },
    ],

    emptyMessage: 'Nenhum vídeo cadastrado ainda',
    emptyIcon: Youtube,

    defaultPageSize: 50,
    pageSizeOptions: [25, 50, 100],
  });
}
