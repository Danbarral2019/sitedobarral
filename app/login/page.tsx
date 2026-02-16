'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('curso');
  const returnTo = searchParams.get('returnTo');
  const message = searchParams.get('message');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações básicas
    if (!formData.email.trim() || !formData.password) {
      setError('Email e senha são obrigatórios');
      return;
    }

    // Validação de formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError('Formato de email inválido');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Se precisa verificar email, mostra mensagem específica
        if (data.needsVerification) {
          setError('Email não verificado. Por favor, verifique sua caixa de entrada e clique no link de verificação que enviamos.');
          return;
        }
        setError(data.error || 'Erro ao fazer login');
        return;
      }

      // Sucesso - redireciona
      if (returnTo) {
        router.push(returnTo);
      } else if (courseId) {
        router.push(`/area-restrita?curso=${courseId}`);
      } else {
        router.push('/area-restrita');
      }
    } catch (err) {
      console.error('Erro ao fazer login:', err);
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-[var(--bg-primary)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-[var(--bg-card)] rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2 font-cinzel">
              Área do Aluno
            </h1>
            <p className="text-[var(--text-secondary)]">
              Faça login para acessar os materiais do curso
            </p>
          </div>

          {/* Mensagem de informação */}
          {message === 'account-exists' && (
            <div className="mb-6 p-4 bg-brand-50 border border-brand-200 rounded-lg">
              <p className="text-sm text-brand-800 font-medium">
                Você já possui uma conta cadastrada. Faça login para acessar os materiais do curso.
              </p>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-[var(--border-strong)] rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-[var(--bg-input)] text-[var(--text-primary)]"
                placeholder="seu@email.com"
                disabled={loading}
                autoComplete="email"
              />
            </div>

            {/* Senha */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Senha
              </label>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-[var(--border-strong)] rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-[var(--bg-input)] text-[var(--text-primary)]"
                placeholder="Sua senha"
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-brand-700 transition-colors disabled:bg-[var(--text-muted)] disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Links úteis */}
          <div className="mt-6 space-y-3">
            <div className="text-center">
              <p className="text-sm text-[var(--text-secondary)]">
                Primeiro acesso?{' '}
                <Link
                  href="/validar-acesso"
                  className="text-brand-600 hover:text-brand-700 font-medium"
                >
                  Escaneie o QR Code do seu curso
                </Link>
              </p>
            </div>

            <div className="text-center pt-3 border-t border-[var(--border-default)]">
              <p className="text-sm text-[var(--text-secondary)]">
                Esqueceu sua senha?{' '}
                <Link
                  href="/esqueci-senha"
                  className="text-brand-600 hover:text-brand-700 font-medium"
                >
                  Redefinir senha
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Informações adicionais */}
        <div className="mt-6 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            O login é vinculado ao curso que você acessou via QR Code.
            <br />
            Caso não consiga acessar, verifique com o professor.
          </p>
        </div>

        {/* Link para voltar */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            ← Voltar para o site
          </Link>
        </div>
      </div>
    </div>
  );
}
