'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

export default function ConfirmacaoRegistroPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email');
  const _isOpen = searchParams.get('open') === 'true';
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');

  const handleResendEmail = async () => {
    if (!email) return;

    setResendLoading(true);
    setResendMessage('');

    try {
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendMessage('✅ Email reenviado com sucesso! Verifique sua caixa de entrada (e spam).');
      } else {
        setResendMessage(data.error || 'Erro ao reenviar email. Tente novamente mais tarde.');
      }
    } catch {
      setResendMessage('Erro ao reenviar email. Tente novamente mais tarde.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-[6px] p-8 md:p-12 border border-border-subtle">
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
            <h1 className="text-3xl font-bold text-ink-primary mb-2">
              Conta Criada com Sucesso!
            </h1>
            <p className="text-ink-muted">
              Falta só mais um passo para acessar os materiais do curso
            </p>
          </div>

          {/* Instruções */}
          <div className="bg-brand-50 border border-brand-200 rounded-[6px] p-6 mb-8">
            <h2 className="text-lg font-semibold text-brand-900 mb-3">
              📧 Verifique seu email
            </h2>
            <div className="space-y-3 text-sm text-brand-800">
              <p>
                Enviamos um email de verificação para:{' '}
                <strong className="font-semibold">{email || 'seu email'}</strong>
              </p>
              <p>
                Para ativar sua conta e acessar os materiais do curso, clique no link de verificação que está no email.
              </p>
              <p className="text-brand-700">
                <strong>Dica:</strong> Se não encontrar o email, verifique sua pasta de spam ou lixo eletrônico.
              </p>
            </div>
          </div>

          {/* Tempo de validade */}
          <div className="bg-amber-accent-soft border border-amber-accent-soft rounded-[6px] p-6 mb-8">
            <h3 className="text-sm font-semibold text-amber-accent-deep mb-2">
              ⏰ Link válido por 24 horas
            </h3>
            <p className="text-sm text-amber-accent-deep">
              O link de verificação expira em 24 horas. Após esse período, será necessário solicitar um novo link.
            </p>
          </div>

          {/* Verificação manual com token */}
          <div className="bg-surface-raised border border-border-subtle rounded-[6px] p-6 mb-8">
            <h3 className="text-sm font-semibold text-ink-primary mb-3">
              Recebeu o link por email? Cole o token aqui:
            </h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!verifyToken.trim()) return;
              setVerifyLoading(true);
              setVerifyMessage('');
              try {
                const response = await fetch('/api/auth/verify-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token: verifyToken.trim() }),
                });
                const data = await response.json();
                if (response.ok) {
                  setVerifyMessage('Email verificado com sucesso! Redirecionando...');
                  setTimeout(() => router.push('/area-restrita'), 2000);
                } else {
                  setVerifyMessage(data.error || 'Token inválido ou expirado. Tente novamente.');
                }
              } catch {
                setVerifyMessage('Erro ao verificar. Tente novamente.');
              } finally {
                setVerifyLoading(false);
              }
            }} className="space-y-3">
              <input
                type="text"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                placeholder="Cole o token de verificação"
                className="w-full px-4 py-3 border border-border-subtle rounded-[6px] focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                disabled={verifyLoading}
              />
              <button
                type="submit"
                disabled={verifyLoading || !verifyToken.trim()}
                className="w-full bg-brand-600 text-white py-2.5 px-4 rounded-[6px] font-semibold hover:bg-brand-700 transition-colors disabled:bg-border-strong disabled:cursor-not-allowed text-sm"
              >
                {verifyLoading ? 'Verificando...' : 'Verificar Email'}
              </button>
              {verifyMessage && (
                <p className={`text-sm ${verifyMessage.includes('sucesso') ? 'text-green-600' : 'text-red-600'}`}>
                  {verifyMessage}
                </p>
              )}
            </form>
          </div>

          {/* Botão de reenviar */}
          <div className="text-center mb-8">
            <p className="text-sm text-ink-muted mb-3">
              Não recebeu o email?
            </p>
            <button
              onClick={handleResendEmail}
              disabled={resendLoading}
              className="text-brand-600 hover:text-brand-700 font-medium text-sm underline disabled:text-ink-muted disabled:no-underline"
            >
              {resendLoading ? 'Reenviando...' : 'Clique aqui para reenviar'}
            </button>
            {resendMessage && (
              <p className={`mt-3 text-sm ${resendMessage.includes('sucesso') ? 'text-green-600' : 'text-amber-accent-deep'}`}>
                {resendMessage}
              </p>
            )}
          </div>

          {/* Próximos passos */}
          <div className="border-t border-border-subtle pt-6">
            <h3 className="text-lg font-semibold text-ink-primary mb-3">
              Próximos passos:
            </h3>
            <ol className="space-y-3 text-sm text-ink-secondary">
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center w-6 h-6 bg-brand-100 text-brand-600 rounded-full font-semibold text-xs mr-3 mt-0.5">
                  1
                </span>
                <span>Abra o email que enviamos para <strong>{email || 'você'}</strong></span>
              </li>
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center w-6 h-6 bg-brand-100 text-brand-600 rounded-full font-semibold text-xs mr-3 mt-0.5">
                  2
                </span>
                <span>Clique no link de verificação dentro do email</span>
              </li>
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center w-6 h-6 bg-brand-100 text-brand-600 rounded-full font-semibold text-xs mr-3 mt-0.5">
                  3
                </span>
                <span>Você será redirecionado automaticamente e poderá acessar todos os materiais do curso</span>
              </li>
            </ol>
          </div>

          {/* Link para voltar */}
          <div className="mt-8 text-center border-t border-border-subtle pt-6">
            <Link
              href="/"
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              ← Voltar para o site
            </Link>
          </div>
        </div>

        {/* Suporte */}
        <div className="mt-6 text-center">
          <p className="text-sm text-ink-muted">
            Problemas com o cadastro?{' '}
            <Link href="/contato" className="text-brand-600 hover:text-brand-700 font-medium">
              Entre em contato conosco
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
