'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RedefinirSenhaPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    // Verificar se token está presente
    if (!token) {
      setTokenValid(false);
      setError('Link inválido. Verifique o link no email ou solicite um novo.');
    } else {
      setTokenValid(true);
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações
    if (!formData.newPassword || !formData.confirmPassword) {
      setError('Todos os campos são obrigatórios');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Senha redefinida com sucesso e auto-login realizado
        // Redireciona para área restrita
        setTimeout(() => {
          router.push('/area-restrita');
        }, 2000);
      } else {
        setError(data.error || 'Erro ao redefinir senha');
      }
    } catch (err) {
      console.error('Erro ao redefinir senha:', err);
      setError('Erro ao processar redefinição. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Token inválido ou ausente
  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-[6px] p-8 border border-border-subtle">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-ink-primary mb-2">
                Link Inválido
              </h1>
              <div className="bg-red-50 border border-red-200 rounded-[6px] p-4 mb-6">
                <p className="text-sm text-red-800">{error}</p>
              </div>

              <div className="space-y-3">
                <Link
                  href="/esqueci-senha"
                  className="block w-full bg-brand-600 text-white py-3 px-4 rounded-[6px] font-semibold hover:bg-brand-700 transition-colors"
                >
                  Solicitar Novo Link
                </Link>
                <Link
                  href="/login"
                  className="block w-full border border-border-subtle text-ink-secondary py-3 px-4 rounded-[6px] font-semibold hover:bg-surface-raised transition-colors"
                >
                  Voltar para o Login
                </Link>
              </div>
            </div>
          </div>

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
              Redefinir Senha
            </h1>
            <p className="text-ink-muted">
              Digite sua nova senha abaixo
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
            {/* Nova Senha */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-ink-secondary mb-2">
                Nova Senha
              </label>
              <input
                type="password"
                id="newPassword"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                className="w-full px-4 py-2 border border-border-subtle rounded-[6px] focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Mínimo 6 caracteres"
                disabled={loading}
                autoComplete="new-password"
                required
              />
            </div>

            {/* Confirmar Senha */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink-secondary mb-2">
                Confirmar Nova Senha
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-2 border border-border-subtle rounded-[6px] focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Digite a senha novamente"
                disabled={loading}
                autoComplete="new-password"
                required
              />
            </div>

            {/* Requisitos de senha */}
            <div className="bg-brand-50 border border-brand-200 rounded-[6px] p-4">
              <h3 className="text-sm font-semibold text-brand-900 mb-2">
                Requisitos da senha:
              </h3>
              <ul className="text-sm text-brand-800 space-y-1">
                <li className="flex items-center">
                  <span className={`mr-2 ${formData.newPassword.length >= 6 ? 'text-green-600' : 'text-ink-muted'}`}>
                    {formData.newPassword.length >= 6 ? '✓' : '○'}
                  </span>
                  Mínimo de 6 caracteres
                </li>
                <li className="flex items-center">
                  <span className={`mr-2 ${formData.newPassword && formData.newPassword === formData.confirmPassword ? 'text-green-600' : 'text-ink-muted'}`}>
                    {formData.newPassword && formData.newPassword === formData.confirmPassword ? '✓' : '○'}
                  </span>
                  As senhas devem coincidir
                </li>
              </ul>
            </div>

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 text-white py-3 px-4 rounded-[6px] font-semibold hover:bg-brand-700 transition-colors disabled:bg-border-strong disabled:cursor-not-allowed"
            >
              {loading ? 'Redefinindo...' : 'Redefinir Senha'}
            </button>
          </form>

          {/* Aviso de auto-login */}
          <div className="mt-6 bg-green-50 border border-green-200 rounded-[6px] p-4">
            <p className="text-sm text-green-800">
              ✓ Após redefinir sua senha, você será automaticamente logado e redirecionado para a área restrita.
            </p>
          </div>
        </div>

        {/* Aviso de validade */}
        <div className="mt-6 bg-amber-accent-soft rounded-[6px] p-4">
          <p className="text-sm text-amber-accent-deep">
            ⏰ Este link é válido por <strong>1 hora</strong>. Se expirar, solicite um novo link.
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
