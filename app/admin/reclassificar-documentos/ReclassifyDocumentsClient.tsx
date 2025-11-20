'use client';

import { useState, useEffect } from 'react';
import { courses } from '@/data/courses';

type Document = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  courseId: string | null;
  isCommon: boolean;
  onNumber: number | null;
  onYear: number | null;
  uploadedAt: string;
  updatedAt: string;
};

const categories = [
  { value: 'all', label: 'Todas as Categorias' },
  { value: 'orientacao-normativa', label: 'Orientações Normativas' },
  { value: 'parecer', label: 'Pareceres' },
  { value: 'acordao', label: 'Acórdãos TCU' },
  { value: 'apostila', label: 'Apostilas' },
  { value: 'edital', label: 'Editais' },
  { value: 'artigo', label: 'Artigos' },
  { value: 'modelo', label: 'Modelos' },
  { value: 'legislacao', label: 'Legislação' },
  { value: 'outro', label: 'Outros' }
];

export default function ReclassifyDocumentsClient() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    category: 'all',
    courseId: 'all',
    isCommon: 'all',
    search: ''
  });
  const [actionInProgress, setActionInProgress] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Buscar documentos
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.category !== 'all') params.set('category', filters.category);
      if (filters.courseId !== 'all') params.set('courseId', filters.courseId);
      if (filters.isCommon !== 'all') params.set('isCommon', filters.isCommon);
      if (filters.search) params.set('search', filters.search);

      const response = await fetch(`/api/admin/documents/reclassify?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar documentos');
      }

      setDocuments(data.documents);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [filters]);

  // Selecionar/desselecionar todos
  const toggleSelectAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map(d => d.id)));
    }
  };

  // Selecionar/desselecionar um documento
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Reclassificar documentos
  const reclassifyDocuments = async (action: string, courseId?: string) => {
    if (selectedIds.size === 0) {
      alert('Selecione pelo menos um documento');
      return;
    }

    const confirmMessage = action === 'set-common'
      ? `Marcar ${selectedIds.size} documento(s) como comum (disponível em todos os cursos)?`
      : `Atribuir ${selectedIds.size} documento(s) ao curso selecionado?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setActionInProgress(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/admin/documents/reclassify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentIds: Array.from(selectedIds),
          action,
          courseId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao reclassificar documentos');
      }

      setSuccessMessage(data.message);
      setSelectedIds(new Set());
      await fetchDocuments(); // Recarregar lista

    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  };

  // Reclassificar um único documento
  const reclassifySingle = async (documentId: string, action: string, courseId?: string) => {
    try {
      setActionInProgress(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/admin/documents/reclassify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentIds: [documentId],
          action,
          courseId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao reclassificar documento');
      }

      setSuccessMessage(data.message);
      await fetchDocuments(); // Recarregar lista

    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  };

  // Get course name by ID
  const getCourseName = (courseId: string | null) => {
    if (!courseId) return 'N/A';
    const course = courses.find(c => c.id === courseId);
    return course?.title || courseId;
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoria
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Curso */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Curso
            </label>
            <select
              value={filters.courseId}
              onChange={(e) => setFilters({ ...filters, courseId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos os Cursos</option>
              <option value="null">Sem Curso Específico</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          {/* Disponibilidade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Disponibilidade
            </label>
            <select
              value={filters.isCommon}
              onChange={(e) => setFilters({ ...filters, isCommon: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="true">Comum (Todos os Cursos)</option>
              <option value="false">Curso Específico</option>
            </select>
          </div>

          {/* Busca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Título ou descrição..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Mensagens */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
          {successMessage}
        </div>
      )}

      {/* Ações em Bloco */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-blue-900 font-medium">
              {selectedIds.size} documento(s) selecionado(s)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => reclassifyDocuments('set-common')}
                disabled={actionInProgress}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Marcar como Comum
              </button>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    reclassifyDocuments('set-course', e.target.value);
                    e.target.value = '';
                  }
                }}
                disabled={actionInProgress}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Atribuir a Curso...</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setSelectedIds(new Set())}
                disabled={actionInProgress}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50"
              >
                Limpar Seleção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Documentos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            Documentos ({documents.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Carregando documentos...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhum documento encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === documents.length && documents.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Título
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status Atual
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Curso
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className={selectedIds.has(doc.id) ? 'bg-blue-50' : ''}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => toggleSelect(doc.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {doc.title}
                      </div>
                      {doc.description && (
                        <div className="text-sm text-gray-500 truncate max-w-md">
                          {doc.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        {doc.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {doc.isCommon ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Comum (Todos)
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          Específico
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {doc.isCommon ? 'Todos os cursos' : getCourseName(doc.courseId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        {!doc.isCommon && (
                          <button
                            onClick={() => reclassifySingle(doc.id, 'set-common')}
                            disabled={actionInProgress}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            title="Marcar como comum"
                          >
                            Comum
                          </button>
                        )}
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              reclassifySingle(doc.id, 'set-course', e.target.value);
                              e.target.value = '';
                            }
                          }}
                          disabled={actionInProgress}
                          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                        >
                          <option value="">Curso...</option>
                          {courses.map(course => (
                            <option key={course.id} value={course.id}>
                              {course.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
