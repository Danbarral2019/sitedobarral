'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Plus, Trash2, Globe, Link as LinkIcon } from 'lucide-react';
import { courses } from '@/data/courses';

interface RecommendedSite {
  id: string;
  title: string;
  description: string;
  url: string;
  faviconUrl: string | null;
  category: string | null;
  displayOrder: number;
  isActive: boolean;
  courses?: Array<{ courseId: string }>;
}

export default function SitesAdminPage() {
  const [sites, setSites] = useState<RecommendedSite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    category: '',
    courseIds: [] as string[],
  });

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      const response = await fetch('/api/admin/recommended-sites');
      if (response.ok) {
        const data = await response.json();
        setSites(data.sites || []);
      }
    } catch (error) {
      console.error('Erro ao carregar sites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/admin/recommended-sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setFormData({ title: '', description: '', url: '', category: '', courseIds: [] });
        setShowForm(false);
        loadSites();
      } else {
        alert('Erro ao adicionar site');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao adicionar site');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este site?')) return;

    try {
      const response = await fetch(`/api/admin/recommended-sites/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadSites();
      } else {
        alert('Erro ao remover site');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao remover site');
    }
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gerenciar Sites Recomendados</h1>
          <p className="text-gray-600">Adicione links úteis e sites de referência</p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="mb-6 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Adicionar Site
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="grid gap-4">
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Título do site"
                className="px-4 py-2 border rounded-lg"
              />
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição"
                rows={2}
                className="px-4 py-2 border rounded-lg"
              />
              <input
                type="url"
                required
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://..."
                className="px-4 py-2 border rounded-lg"
              />
              <select
                multiple
                value={formData.courseIds}
                onChange={(e) => setFormData({
                  ...formData,
                  courseIds: Array.from(e.target.selectedOptions, option => option.value)
                })}
                className="px-4 py-2 border rounded-lg h-32"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500">Segure Ctrl/Cmd para selecionar múltiplos cursos</p>
              <div className="flex gap-3">
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg">
                  Adicionar
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-200 rounded-lg">
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="bg-white rounded-lg shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center">Carregando...</div>
          ) : sites.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Nenhum site adicionado ainda.</div>
          ) : (
            <div className="divide-y">
              {sites.map((site) => (
                <div key={site.id} className="p-6 flex items-start gap-4">
                  <Globe className="w-6 h-6 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-bold mb-1">{site.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{site.description}</p>
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <LinkIcon className="w-3 h-3" />
                      {site.url}
                    </a>
                  </div>
                  <button
                    onClick={() => handleDelete(site.id)}
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
