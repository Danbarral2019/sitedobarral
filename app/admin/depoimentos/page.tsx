'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Star, Check, X, Edit2, Trash2, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Testimonial {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  text: string;
  rating: number;
  avatar: string;
  color: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  rejectionReason: string | null;
}

interface Stats {
  pending: number;
  approved: number;
  rejected: number;
}

export default function DepoimentosPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, rejected: 0 });
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Testimonial>>({});
  const { successToast, errorToast } = useToast();

  useEffect(() => {
    loadTestimonials();
  }, [filter]);

  const loadTestimonials = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/testimonials?status=${filter}`);
      const data = await response.json();

      if (data.success) {
        setTestimonials(data.testimonials);
        setStats(data.stats);
      } else {
        errorToast('Erro ao carregar depoimentos');
      }
    } catch (error) {
      console.error('Erro ao carregar depoimentos:', error);
      errorToast('Erro ao carregar depoimentos');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch('/api/admin/testimonials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'approve' }),
      });

      const data = await response.json();

      if (data.success) {
        successToast('Depoimento aprovado!');
        loadTestimonials();
      } else {
        errorToast(data.error || 'Erro ao aprovar');
      }
    } catch (error) {
      console.error('Erro ao aprovar:', error);
      errorToast('Erro ao aprovar depoimento');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Motivo da rejeição (opcional):');
    if (reason === null) return; // Cancelou

    try {
      const response = await fetch('/api/admin/testimonials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: 'reject',
          data: { rejectionReason: reason || null },
        }),
      });

      const data = await response.json();

      if (data.success) {
        successToast('Depoimento rejeitado');
        loadTestimonials();
      } else {
        errorToast(data.error || 'Erro ao rejeitar');
      }
    } catch (error) {
      console.error('Erro ao rejeitar:', error);
      errorToast('Erro ao rejeitar depoimento');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este depoimento?')) return;

    try {
      const response = await fetch(`/api/admin/testimonials?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        successToast('Depoimento deletado');
        loadTestimonials();
      } else {
        errorToast(data.error || 'Erro ao deletar');
      }
    } catch (error) {
      console.error('Erro ao deletar:', error);
      errorToast('Erro ao deletar depoimento');
    }
  };

  const handleStartEdit = (testimonial: Testimonial) => {
    setEditingId(testimonial.id);
    setEditForm({
      name: testimonial.name,
      role: testimonial.role,
      text: testimonial.text,
      rating: testimonial.rating,
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const response = await fetch('/api/admin/testimonials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: 'edit',
          data: editForm,
        }),
      });

      const data = await response.json();

      if (data.success) {
        successToast('Depoimento atualizado!');
        setEditingId(null);
        loadTestimonials();
      } else {
        errorToast(data.error || 'Erro ao atualizar');
      }
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      errorToast('Erro ao atualizar depoimento');
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-semibold rounded-full">
            <Clock className="w-4 h-4" />
            Pendente
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full">
            <CheckCircle className="w-4 h-4" />
            Aprovado
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 text-sm font-semibold rounded-full">
            <XCircle className="w-4 h-4" />
            Rejeitado
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Moderação de Depoimentos</h1>
          <p className="text-gray-600">Gerencie os depoimentos enviados pelos alunos</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-600 text-sm font-semibold">Pendentes</p>
                <p className="text-3xl font-bold text-yellow-900">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-semibold">Aprovados</p>
                <p className="text-3xl font-bold text-green-900">{stats.approved}</p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-semibold">Rejeitados</p>
                <p className="text-3xl font-bold text-red-900">{stats.rejected}</p>
              </div>
              <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                <XCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pendentes ({stats.pending})
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Aprovados ({stats.approved})
            </button>
            <button
              onClick={() => setFilter('rejected')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'rejected'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rejeitados ({stats.rejected})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
          </div>
        </div>

        {/* Testimonials List */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : testimonials.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg">Nenhum depoimento encontrado</p>
          </div>
        ) : (
          <div className="space-y-6">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className={`w-16 h-16 bg-gradient-to-br ${testimonial.color} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-2xl font-bold">{testimonial.avatar}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        {editingId === testimonial.id ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="text-lg font-bold text-gray-900 border-b-2 border-blue-500 focus:outline-none mb-1"
                          />
                        ) : (
                          <h3 className="text-lg font-bold text-gray-900">{testimonial.name}</h3>
                        )}
                        {editingId === testimonial.id ? (
                          <input
                            type="text"
                            value={editForm.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                            className="text-sm text-gray-600 border-b border-blue-500 focus:outline-none"
                          />
                        ) : (
                          <p className="text-sm text-gray-600">{testimonial.role}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(testimonial.status)}
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="mb-3">
                      {editingId === testimonial.id ? (
                        <select
                          value={editForm.rating}
                          onChange={(e) => setEditForm({ ...editForm, rating: parseInt(e.target.value) })}
                          className="border rounded px-2 py-1"
                        >
                          {[1, 2, 3, 4, 5].map((r) => (
                            <option key={r} value={r}>{r} estrelas</option>
                          ))}
                        </select>
                      ) : (
                        renderStars(testimonial.rating)
                      )}
                    </div>

                    {/* Text */}
                    {editingId === testimonial.id ? (
                      <textarea
                        value={editForm.text}
                        onChange={(e) => setEditForm({ ...editForm, text: e.target.value })}
                        rows={4}
                        className="w-full border-2 border-blue-500 rounded p-2 text-gray-700 focus:outline-none focus:border-blue-600 mb-3"
                      />
                    ) : (
                      <p className="text-gray-700 mb-4 leading-relaxed">{testimonial.text}</p>
                    )}

                    {/* Contact Info */}
                    <div className="text-sm text-gray-500 mb-4">
                      <p><strong>Email:</strong> {testimonial.email}</p>
                      {testimonial.phone && <p><strong>Telefone:</strong> {testimonial.phone}</p>}
                      <p><strong>Enviado em:</strong> {new Date(testimonial.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>

                    {/* Rejection Reason */}
                    {testimonial.status === 'rejected' && testimonial.rejectionReason && (
                      <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4">
                        <p className="text-sm text-red-800">
                          <strong>Motivo da rejeição:</strong> {testimonial.rejectionReason}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {editingId === testimonial.id ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(testimonial.id)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          {testimonial.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(testimonial.id)}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                              >
                                <Check className="w-4 h-4" />
                                Aprovar
                              </button>
                              <button
                                onClick={() => handleReject(testimonial.id)}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
                              >
                                <X className="w-4 h-4" />
                                Rejeitar
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleStartEdit(testimonial)}
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(testimonial.id)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Deletar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
