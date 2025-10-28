'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import AdminLayout from '@/components/AdminLayout';
import { Plus, Trash2, Youtube, ExternalLink } from 'lucide-react';
import { courses } from '@/data/courses';

interface CourseVideo {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  youtubeUrl: string;
  youtubeId: string;
  thumbnailUrl: string | null;
  displayOrder: number;
  isActive: boolean;
}

export default function VideosAdminPage() {
  const [videos, setVideos] = useState<CourseVideo[]>([]);
  const [selectedCourse, setSelectedCourse] = useState(courses[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    youtubeUrl: '',
  });

  const loadVideos = useCallback(async () => {
    try {
      const response = await fetch(`/api/course-videos?courseId=${selectedCourse}`);
      if (response.ok) {
        const data = await response.json();
        setVideos(data.videos || []);
      }
    } catch (error) {
      console.error('Erro ao carregar vídeos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCourse]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/admin/course-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          courseId: selectedCourse,
        }),
      });

      if (response.ok) {
        setFormData({ title: '', description: '', youtubeUrl: '' });
        setShowForm(false);
        loadVideos();
      } else {
        alert('Erro ao adicionar vídeo');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao adicionar vídeo');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este vídeo?')) return;

    try {
      const response = await fetch(`/api/admin/course-videos/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadVideos();
      } else {
        alert('Erro ao remover vídeo');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao remover vídeo');
    }
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gerenciar Vídeos do YouTube</h1>
          <p className="text-gray-600">Adicione e gerencie vídeos para cada curso</p>
        </div>

        {/* Seletor de Curso */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecione o Curso
          </label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>

        {/* Botão Adicionar */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="mb-6 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Adicionar Vídeo
        </button>

        {/* Formulário */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título do Vídeo
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição (opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL do YouTube
                </label>
                <input
                  type="url"
                  required
                  value={formData.youtubeUrl}
                  onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Adicionar
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Lista de Vídeos */}
        <div className="bg-white rounded-lg shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">Carregando...</div>
          ) : videos.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              Nenhum vídeo adicionado a este curso ainda.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {videos.map((video) => (
                <div key={video.id} className="p-6 flex items-start gap-4">
                  <Image
                    src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                    alt={video.title}
                    width={160}
                    height={96}
                    className="w-40 h-24 object-cover rounded-lg"
                    unoptimized
                  />
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">{video.title}</h3>
                    {video.description && (
                      <p className="text-sm text-gray-600 mb-2">{video.description}</p>
                    )}
                    <a
                      href={video.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Youtube className="w-4 h-4" />
                      Ver no YouTube
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <button
                    onClick={() => handleDelete(video.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
