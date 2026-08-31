'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function RegistroPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qrCode = searchParams.get('qr');
  const courseId = searchParams.get('curso');
  const returnTo = searchParams.get('returnTo');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações básicas
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Todos os campos são obrigatórios');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (formData.password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          ...(qrCode && { qrCodeId: qrCode }),
          courseId: courseId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erro ao criar conta');
        return;
      }

      // Sucesso - redireciona para página de confirmação
      const confirmParams = new URLSearchParams({ email: formData.email });
      if (!qrCode) confirmParams.set('open', 'true');
      if (returnTo) confirmParams.set('returnTo', returnTo);
      router.push(`/registro/confirmacao?${confirmParams.toString()}`);
    } catch (err) {
      console.error('Erro ao registrar:', err);
      setError('Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-[6px] p-8 border border-border-subtle">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-ink-primary mb-2">
              Criar Conta
            </h1>
            <p className="text-ink-muted">
              {qrCode
                ? 'Primeiro acesso - Crie suas credenciais'
                : 'Cadastre-se para acessar conteúdo público e explorar os planos'}
            </p>
          </div>

          {/* Erro */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-[6px]">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-ink-secondary mb-2">
                Nome Completo
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-border-subtle rounded-[6px] focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Seu nome completo"
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-secondary mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-border-subtle rounded-[6px] focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="seu@email.com"
                disabled={loading}
              />
            </div>

            {/* Senha */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink-secondary mb-2">
                Senha
              </label>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-border-subtle rounded-[6px] focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Mínimo 6 caracteres"
                disabled={loading}
              />
            </div>

            {/* Confirmar Senha */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink-secondary mb-2">
                Confirmar Senha
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-2 border border-border-subtle rounded-[6px] focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Digite a senha novamente"
                disabled={loading}
              />
            </div>

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 text-white py-3 px-4 rounded-[6px] font-semibold hover:bg-brand-700 transition-colors disabled:bg-border-strong disabled:cursor-not-allowed"
            >
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </button>
          </form>

          {/* Link para login */}
          <div className="mt-6 text-center">
            <p className="text-sm text-ink-muted">
              Já tem uma conta?{' '}
              <Link
                href={`/login${courseId ? `?curso=${courseId}` : ''}`}
                className="text-brand-600 hover:text-brand-700 font-medium"
              >
                Fazer login
              </Link>
            </p>
          </div>
        </div>

        {/* Informações sobre QR Code */}
        {qrCode && (
          <div className="mt-6 text-center">
            <p className="text-sm text-ink-muted">
              Este registro está vinculado ao QR Code escaneado.
              <br />
              Após criar sua conta, você poderá fazer login diretamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
