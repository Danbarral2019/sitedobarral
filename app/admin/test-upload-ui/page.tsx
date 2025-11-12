'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { ModernFileUploader, UploadFile } from '@/components/admin/ModernFileUploader';
import { courses } from '@/data/courses';

/**
 * Test Upload UI Page
 *
 * Página de demonstração/teste do ModernFileUploader com presigned URLs.
 * Esta página permite testar o fluxo completo de upload sem afetar
 * a página principal de documentos.
 *
 * Acesso: /admin/test-upload-ui
 */

interface DocumentFormData {
  courseId: string;
  title: string;
  description: string;
  category: string;
  isPublic: boolean;
  tags: string[];
}

export default function TestUploadUIPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<UploadFile[]>([]);

  // Form state
  const [formData, setFormData] = useState<DocumentFormData>({
    courseId: '',
    title: '',
    description: '',
    category: 'apostila',
    isPublic: false,
    tags: [],
  });

  // Verify admin access
  useEffect(() => {
    async function verifyAdmin() {
      try {
        const response = await fetch('/api/auth/verify');
        if (!response.ok) {
          router.push('/admin/login');
          return;
        }

        const data = await response.json();
        if (data.user.role !== 'admin') {
          router.push('/admin/login');
          return;
        }
      } catch (error) {
        console.error('Erro ao verificar admin:', error);
        router.push('/admin/login');
      } finally {
        setIsLoading(false);
      }
    }

    verifyAdmin();
  }, [router]);

  const handleUploadComplete = (files: UploadFile[]) => {
    console.log('✅ Upload completed:', files);
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const handleUploadStart = (files: File[]) => {
    console.log('🚀 Upload started:', files.map((f) => f.name));
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verificando acesso...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 Test Upload UI - ModernFileUploader
          </h1>
          <p className="text-gray-600">
            Página de teste para o novo sistema de upload com presigned URLs
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Arquitetura:</strong> Presigned URLs → Upload direto R2 → Confirmação backend
            </p>
            <p className="text-sm text-blue-800 mt-1">
              <strong>Features:</strong> Drag-and-drop, preview, progress bar, validação
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📤 Upload de Documentos
          </h2>

          {/* Simple Form */}
          <div className="mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Curso
              </label>
              <select
                value={formData.courseId}
                onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Selecione um curso</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="apostila">Apostila</option>
                <option value="acordao">Acórdão</option>
                <option value="parecer">Parecer</option>
                <option value="edital">Edital</option>
                <option value="artigo">Artigo</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">
                  Documento público (visível sem login)
                </span>
              </label>
            </div>
          </div>

          {/* Modern File Uploader */}
          <ModernFileUploader
            accept=".pdf,.doc,.docx"
            maxSize={50 * 1024 * 1024} // 50MB
            maxFiles={5}
            onUploadComplete={handleUploadComplete}
            onUploadStart={handleUploadStart}
            autoUpload={true}
          />
        </div>

        {/* Uploaded Files Summary */}
        {uploadedFiles.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              ✅ Arquivos Enviados ({uploadedFiles.length})
            </h2>

            <div className="space-y-3">
              {uploadedFiles.map((file, index) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{file.file.name}</p>
                    <p className="text-sm text-gray-600">
                      {(file.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">R2 Key</p>
                      <p className="text-xs font-mono text-gray-700 max-w-xs truncate">
                        {file.r2Key}
                      </p>
                    </div>

                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Ver Arquivo
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Next Steps Info */}
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>💡 Próximos passos:</strong>
              </p>
              <ul className="text-sm text-yellow-800 mt-2 space-y-1 list-disc list-inside">
                <li>Arquivos foram enviados para R2 com sucesso</li>
                <li>Registros criados no PostgreSQL com r2Key</li>
                <li>IndexJobs enfileirados para indexação Gemini</li>
                <li>Processar formulário e associar metadados adicionais (curso, categoria, etc)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Debug Info */}
        <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">🔍 Debug Info</h3>
          <pre className="text-xs text-gray-600 overflow-auto">
            {JSON.stringify(
              {
                formData,
                uploadedCount: uploadedFiles.length,
                uploadedFiles: uploadedFiles.map((f) => ({
                  name: f.file.name,
                  size: f.file.size,
                  r2Key: f.r2Key,
                  url: f.url,
                })),
              },
              null,
              2
            )}
          </pre>
        </div>
      </div>
    </AdminLayout>
  );
}
