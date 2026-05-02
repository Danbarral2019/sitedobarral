'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, ArrowLeft, Trash2, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AVATAR_COLORS = [
  { label: 'Azul', value: 'from-blue-400 to-blue-600' },
  { label: 'Verde', value: 'from-green-400 to-green-600' },
  { label: 'Roxo', value: 'from-purple-400 to-purple-600' },
  { label: 'Laranja', value: 'from-orange-400 to-orange-600' },
  { label: 'Rosa', value: 'from-pink-400 to-pink-600' },
  { label: 'Vermelho', value: 'from-red-400 to-red-600' },
  { label: 'Teal', value: 'from-teal-400 to-teal-600' },
  { label: 'Indigo', value: 'from-indigo-400 to-indigo-600' },
];

export default function EditDepoimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [id, setId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    text: '',
    rating: 5,
    avatar: '',
    color: 'from-blue-400 to-blue-600',
    status: 'pending',
    rejectionReason: '',
  });

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

  const loadTestimonial = useCallback(async (testimonialId: string) => {
    try {
      const response = await fetch(`/api/admin/depoimentos/${testimonialId}`);
      if (!response.ok) throw new Error('Depoimento não encontrado');

      const data = await response.json();
      const t = data.testimonial;

      setFormData({
        name: t.name,
        email: t.email,
        phone: t.phone || '',
        role: t.role,
        text: t.text,
        rating: t.rating,
        avatar: t.avatar || t.name.charAt(0).toUpperCase(),
        color: t.color || 'from-blue-400 to-blue-600',
        status: t.status || 'pending',
        rejectionReason: t.rejectionReason || '',
      });
    } catch (error) {
      console.error('Erro ao carregar depoimento:', error);
      errorToast('Erro ao carregar', 'Depoimento não encontrado.');
      router.push('/admin/depoimentos');
    } finally {
      setIsLoading(false);
    }
    // errorToast vem do useToast() — nova ref a cada render, dispara loop
    // se entrar nas deps. router é estável (Next.js).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    const init = async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);
      await verifyAdmin();
      await loadTestimonial(resolvedParams.id);
    };
    init();
  }, [params, verifyAdmin, loadTestimonial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/depoimentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao atualizar depoimento');

      success('Depoimento atualizado!', 'As alterações foram salvas com sucesso.');
      router.push('/admin/depoimentos');
    } catch (error) {
      errorToast(
        'Erro ao atualizar',
        error instanceof Error ? error.message : 'Tente novamente.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja deletar este depoimento? Esta ação não pode ser desfeita.')) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/depoimentos/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao deletar depoimento');

      success('Depoimento deletado!', 'O depoimento foi removido com sucesso.');
      router.push('/admin/depoimentos');
    } catch {
      errorToast('Erro ao deletar', 'Tente novamente.');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin/depoimentos')}
            className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors mb-4 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Depoimentos
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Editar Depoimento</h1>
          <p className="text-gray-600">Edite as informações do depoimento</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados pessoais */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value, avatar: e.target.value.charAt(0).toUpperCase() || formData.avatar })}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-600 text-gray-900"
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-600 text-gray-900"
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Cargo/Função *</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-600 text-gray-900"
                  placeholder="Ex: Pregoeiro, Analista de Licitações"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Telefone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-600 text-gray-900"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            {/* Depoimento */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">Depoimento *</label>
              <textarea
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                required
                rows={5}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-600 text-gray-900"
                placeholder="Texto do depoimento..."
              />
            </div>

            {/* Avaliação */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">Avaliação *</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating: star })}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        star <= formData.rating
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-gray-300 hover:text-yellow-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-gray-600">{formData.rating}/5</span>
              </div>
            </div>

            {/* Avatar */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Inicial do Avatar</label>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${formData.color} flex items-center justify-center text-white font-bold text-lg`}>
                    {formData.avatar}
                  </div>
                  <input
                    type="text"
                    value={formData.avatar}
                    onChange={(e) => setFormData({ ...formData, avatar: e.target.value.charAt(0).toUpperCase() })}
                    maxLength={1}
                    className="w-20 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-600 text-gray-900 text-center font-bold text-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Cor do Avatar</label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: c.value })}
                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${c.value} transition-all ${
                        formData.color === c.value ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:scale-105'
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Status de moderação */}
            <div className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Moderação</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-600 text-gray-900"
                  >
                    <option value="pending">Pendente</option>
                    <option value="approved">Aprovado</option>
                    <option value="rejected">Rejeitado</option>
                  </select>
                </div>
                {formData.status === 'rejected' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">Motivo da Rejeição</label>
                    <input
                      type="text"
                      value={formData.rejectionReason}
                      onChange={(e) => setFormData({ ...formData, rejectionReason: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-600 text-gray-900"
                      placeholder="Motivo da rejeição..."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSaving || isDeleting}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Salvar Alterações
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving || isDeleting}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Deletando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    Deletar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
