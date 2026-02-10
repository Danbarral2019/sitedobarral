'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Award,
  ChevronRight,
  Loader2,
  ExternalLink,
  Search,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';

interface CertificateData {
  id: string;
  certificateNumber: string;
  studentName: string;
  courseTitle: string;
  estimatedHours: number | null;
  issuedAt: string;
  user: {
    email: string;
  };
}

export default function CertificatesListClient() {
  const router = useRouter();
  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const pageSize = 20;

  const verifyAdmin = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify');
      if (!response.ok) {
        router.push('/validar-acesso');
        return;
      }
      const data = await response.json();
      if (data.user.role !== 'admin') {
        router.push('/area-restrita');
      }
    } catch {
      router.push('/validar-acesso');
    }
  }, [router]);

  const loadCertificates = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/certificates?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setCertificates(data.certificates || []);
      setTotal(data.total || 0);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    verifyAdmin();
  }, [verifyAdmin]);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link href="/admin" className="hover:text-gray-700">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin/lms" className="hover:text-gray-700">
              LMS
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 font-medium">Certificados</span>
          </nav>

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Certificados</h1>
              <p className="text-gray-600 mt-1">
                {total} certificado{total !== 1 ? 's' : ''} emitido
                {total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por nome, email ou numero..."
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 text-sm"
              />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : certificates.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {search
                  ? 'Nenhum certificado encontrado para esta busca'
                  : 'Nenhum certificado emitido ainda'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">
                        Numero
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">
                        Aluno
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">
                        Curso
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">
                        Emissao
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">
                        Acoes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {certificates.map((cert) => (
                      <tr key={cert.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-medium text-gray-900">
                            {cert.certificateNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {cert.studentName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {cert.user.email}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {cert.courseTitle}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(cert.issuedAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`/certificado/${cert.certificateNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Verificar
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Pagina {page} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="px-3 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
                    >
                      Proxima
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
