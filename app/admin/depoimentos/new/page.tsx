'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Save, ArrowLeft, Star } from 'lucide-react';
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

export default function NewDepoimentoPage() {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    text: '',
    rating: 5,
    avatar: '',
    color: 'from-blue-400 to-blue-600',
    status: 'approved',
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
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    verifyAdmin();
  }, [verifyAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch('/api/admin/depoimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          avatar: formData.avatar || formData.name.charAt(0).toUpperCase(),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao criar depoimento');

      success('Depoimento criado!', 'O depoimento foi adicionado com sucesso.');
      router.push('/admin/depoimentos');
    } catch (error) {
      errorToast(
        'Erro ao criar',
        error instanceof Error ? error.message : 'Tente novamente.'
      );
    } finally {
      setIsSaving(false);
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Novo Depoimento</h1>
          <p className="text-gray-600">Adicione um novo depoimento manualmente</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Inicial do Avatar</label>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${formData.color} flex items-center justify-center text-white font-bold text-lg`}>
                    {formData.avatar || '?'}
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

            <div className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200">
              <label className="block text-sm font-bold text-gray-900 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full md:w-1/2 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-600 text-gray-900"
              >
                <option value="pending">Pendente</option>
                <option value="approved">Aprovado</option>
                <option value="rejected">Rejeitado</option>
              </select>
            </div>

            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSaving}
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
                    Criar Depoimento
                  </>
                )}
              </button>
              <Link
                href="/admin/depoimentos"
                className="px-6 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
