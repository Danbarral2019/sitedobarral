'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Email é obrigatório');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Erro ao processar solicitação');
      }
    } catch (err) {
      console.error('Erro ao solicitar redefinição:', err);
      setError('Erro ao processar solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-[6px] p-8 border border-border-subtle">
            {/* Ícone de sucesso */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-ink-primary mb-2">
                Email Enviado!
              </h1>
              <p className="text-ink-muted">
                Verifique sua caixa de entrada
              </p>
            </div>

            {/* Instruções */}
            <div className="bg-brand-50 border border-brand-200 rounded-[6px] p-6 mb-6">
              <h2 className="text-sm font-semibold text-brand-900 mb-3">
                📧 Próximos passos:
              </h2>
              <div className="space-y-2 text-sm text-brand-800">
                <p>
                  Se o email <strong>{email}</strong> estiver cadastrado, você receberá instruções para redefinir sua senha.
                </p>
                <p className="text-brand-700">
                  <strong>Dica:</strong> Verifique também sua pasta de spam.
                </p>
              </div>
            </div>

            {/* Aviso sobre validade */}
            <div className="bg-amber-accent-soft border border-amber-accent-soft rounded-[6px] p-4 mb-6">
              <p className="text-sm text-amber-accent-deep">
                ⏰ O link de redefinição é válido por <strong>1 hora</strong>
              </p>
            </div>

            {/* Botões */}
            <div className="space-y-3">
              <Link
                href="/login"
                className="block w-full bg-brand-600 text-white py-3 px-4 rounded-[6px] font-semibold hover:bg-brand-700 transition-colors text-center"
              >
                Voltar para o Login
              </Link>
              <button
                onClick={() => setSubmitted(false)}
                className="block w-full border border-border-subtle text-ink-secondary py-3 px-4 rounded-[6px] font-semibold hover:bg-surface-raised transition-colors"
              >
                Enviar Novo Email
              </button>
            </div>
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

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-[6px] p-8 border border-border-subtle">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-brand-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-ink-primary mb-2">
              Esqueci Minha Senha
            </h1>
            <p className="text-ink-muted">
              Digite seu email para receber instruções de redefinição
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
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-secondary mb-2">
                Email Cadastrado
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-border-subtle rounded-[6px] focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="seu@email.com"
                disabled={loading}
                autoComplete="email"
                required
              />
              <p className="mt-2 text-sm text-ink-muted">
                Digite o email que você usou no cadastro
              </p>
            </div>

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 text-white py-3 px-4 rounded-[6px] font-semibold hover:bg-brand-700 transition-colors disabled:bg-border-strong disabled:cursor-not-allowed"
            >
              {loading ? 'Enviando...' : 'Enviar Link de Redefinição'}
            </button>
          </form>

          {/* Links úteis */}
          <div className="mt-6 space-y-3 border-t border-border-subtle pt-6">
            <div className="text-center">
              <p className="text-sm text-ink-muted">
                Lembrou sua senha?{' '}
                <Link
                  href="/login"
                  className="text-brand-600 hover:text-brand-700 font-medium"
                >
                  Fazer login
                </Link>
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-ink-muted">
                Não tem cadastro?{' '}
                <Link
                  href="/area-restrita"
                  className="text-brand-600 hover:text-brand-700 font-medium"
                >
                  Escaneie o QR Code
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Informações de segurança */}
        <div className="mt-6 bg-surface-raised rounded-[6px] p-4">
          <h3 className="text-sm font-semibold text-ink-primary mb-2">
            🔒 Segurança
          </h3>
          <p className="text-sm text-ink-muted">
            Por segurança, não informamos se o email está cadastrado ou não.
            Se o email existir, você receberá as instruções.
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
