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
  Plus,
  Ban,
  RotateCcw,
  X,
  AlertCircle,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';

interface CertificateData {
  id: string;
  certificateNumber: string;
  studentName: string;
  courseTitle: string;
  courseId: string;
  userId: string;
  estimatedHours: number | null;
  issuedAt: string;
  issuedById: string | null;
  issueReason: string | null;
  revokedAt: string | null;
  revokedById: string | null;
  revokeReason: string | null;
  viewCount: number;
  user: { email: string };
}

interface CourseRef {
  id: string;
  title: string;
}
interface UserRef {
  id: string;
  name: string;
  email: string;
  role: string;
}

type StatusFilter = 'all' | 'active' | 'revoked' | 'manual';

export default function CertificatesListClient() {
  const router = useRouter();
  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<CertificateData | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
        status,
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
  }, [page, search, status]);

  useEffect(() => {
    verifyAdmin();
  }, [verifyAdmin]);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates]);

  const totalPages = Math.ceil(total / pageSize);

  const handleRevoke = async (reason: string) => {
    if (!revokeTarget) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/certificates/${revokeTarget.id}/revoke`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setActionError(j.error || 'Falha ao revogar');
        return;
      }
      setRevokeTarget(null);
      await loadCertificates();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRestore = async (cert: CertificateData) => {
    if (!confirm(`Restaurar o certificado ${cert.certificateNumber}? Ele voltará a ser válido.`)) return;
    try {
      const res = await fetch(`/api/admin/certificates/${cert.id}/restore`, { method: 'PATCH' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Falha ao restaurar');
        return;
      }
      await loadCertificates();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link href="/admin" className="hover:text-gray-700">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin/lms" className="hover:text-gray-700">LMS</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 font-medium">Certificados</span>
          </nav>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Certificados</h1>
              <p className="text-gray-600 mt-1">
                {total} certificado{total !== 1 ? 's' : ''}
                {status !== 'all' && ` · filtro: ${status}`}
              </p>
            </div>
            <button
              onClick={() => setShowIssueModal(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Emitir manualmente
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar por nome, email ou número..."
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 text-sm"
              />
            </div>
            <div className="flex gap-1 border border-gray-300 rounded-lg overflow-hidden">
              {(['all', 'active', 'revoked', 'manual'] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatus(s); setPage(1); }}
                  className={`px-3 py-2 text-xs font-medium ${status === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {s === 'all' ? 'Todos' : s === 'active' ? 'Válidos' : s === 'revoked' ? 'Revogados' : 'Manuais'}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : certificates.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {search ? 'Nenhum certificado encontrado para esta busca' : 'Nenhum certificado emitido ainda'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Número</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Aluno</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Curso</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Emissão</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {certificates.map((cert) => (
                      <tr key={cert.id} className={`hover:bg-gray-50 ${cert.revokedAt ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-medium text-gray-900">{cert.certificateNumber}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{cert.studentName}</p>
                          <p className="text-xs text-gray-500">{cert.user.email}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{cert.courseTitle}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(cert.issuedAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {cert.revokedAt ? (
                              <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-medium" title={cert.revokeReason || ''}>
                                <Ban className="w-3 h-3" />
                                Revogado
                              </span>
                            ) : (
                              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-medium">
                                Válido
                              </span>
                            )}
                            {cert.issuedById && (
                              <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-medium" title={cert.issueReason || 'Emissão manual'}>
                                Manual
                              </span>
                            )}
                            {cert.viewCount > 0 && (
                              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs" title="Visualizações da página pública">
                                {cert.viewCount}👁
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <a
                              href={`/certificado/${cert.certificateNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                              title="Ver página pública"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            {cert.revokedAt ? (
                              <button
                                onClick={() => handleRestore(cert)}
                                className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 text-xs font-medium"
                                title="Restaurar (desfazer revogação)"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setRevokeTarget(cert)}
                                className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 text-xs font-medium"
                                title="Revogar"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-500">Página {page} de {totalPages}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showIssueModal && (
        <IssueManualModal
          onClose={() => setShowIssueModal(false)}
          onSuccess={() => { setShowIssueModal(false); loadCertificates(); }}
        />
      )}
      {revokeTarget && (
        <RevokeModal
          target={revokeTarget}
          error={actionError}
          onClose={() => { setRevokeTarget(null); setActionError(null); }}
          onConfirm={handleRevoke}
        />
      )}
    </AdminLayout>
  );
}

// ─── Modal: emitir manualmente ─────────────────────────────────

function IssueManualModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [userQuery, setUserQuery] = useState('');
  const [users, setUsers] = useState<UserRef[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRef | null>(null);
  const [courses, setCourses] = useState<CourseRef[]>([]);
  const [courseId, setCourseId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/courses-list')
      .then((r) => r.ok ? r.json() : { courses: [] })
      .then((d) => setCourses(d.courses || []));
  }, []);

  useEffect(() => {
    if (userQuery.length < 2) { setUsers([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/admin/users/search?q=${encodeURIComponent(userQuery)}`)
        .then((r) => r.ok ? r.json() : { users: [] })
        .then((d) => setUsers(d.users || []));
    }, 250);
    return () => clearTimeout(t);
  }, [userQuery]);

  const handleSubmit = async () => {
    if (!selectedUser || !courseId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, courseId, reason: reason.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || 'Falha ao emitir');
        return;
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Emitir certificado manualmente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aluno</label>
            {selectedUser ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedUser.name}</p>
                  <p className="text-xs text-gray-500">{selectedUser.email}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">
                  Trocar
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Buscar por nome ou email..."
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                {users.length > 0 && (
                  <ul className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                    {users.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => { setSelectedUser(u); setUserQuery(''); setUsers([]); }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        >
                          <p className="text-sm font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-500">{u.email} · {u.role}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Curso</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: aluno concluiu via outro canal de avaliação..."
              rows={3}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Salvo no registro do certificado para auditoria.</p>
          </div>
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedUser || !courseId || submitting}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Emitindo…' : 'Emitir certificado'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: revogar ─────────────────────────────────

function RevokeModal({
  target,
  error,
  onClose,
  onConfirm,
}: {
  target: CertificateData;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Revogar certificado</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Certificado</p>
            <p className="font-mono text-sm text-gray-900">{target.certificateNumber}</p>
            <p className="text-sm text-gray-700 mt-1">{target.studentName} · {target.courseTitle}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ex: emitido por engano, dados incorretos..."
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
            />
            <p className="text-xs text-gray-500 mt-1">O aluno será notificado por email. A página pública passará a indicar revogação.</p>
          </div>
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700"
          >
            Confirmar revogação
          </button>
        </div>
      </div>
    </div>
  );
}
