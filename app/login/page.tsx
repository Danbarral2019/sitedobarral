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
    if (!formData.email || !formData.password) {
      setError('Email e senha são obrigatórios');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Área do Aluno
            </h1>
            <p className="text-gray-600">
              Faça login para acessar os materiais do curso
            </p>
          </div>

          {/* Mensagem de informação */}
          {message === 'account-exists' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="seu@email.com"
                disabled={loading}
                autoComplete="email"
              />
            </div>

            {/* Senha */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Sua senha"
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Links úteis */}
          <div className="mt-6 space-y-3">
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Primeiro acesso?{' '}
                <Link
                  href="/validar-acesso"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Escaneie o QR Code do seu curso
                </Link>
              </p>
            </div>

            <div className="text-center pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Esqueceu sua senha?{' '}
                <Link
                  href="/esqueci-senha"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Redefinir senha
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Informações adicionais */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            O login é vinculado ao curso que você acessou via QR Code.
            <br />
            Caso não consiga acessar, verifique com o professor.
          </p>
        </div>

        {/* Link para voltar */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Voltar para o site
          </Link>
        </div>
      </div>
    </div>
  );
}
