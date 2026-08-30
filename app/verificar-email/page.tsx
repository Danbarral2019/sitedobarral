'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function VerificarEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'input'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const emailParam = searchParams.get('email');

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: tokenToVerify }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setTimeout(() => {
          router.push('/area-restrita');
        }, 2000);
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Erro ao verificar email. O link pode estar expirado ou inválido.');
      }
    } catch (error) {
      console.error('Erro ao verificar email:', error);
      setStatus('error');
      setErrorMessage('Erro ao processar verificação. Tente novamente mais tarde.');
    }
  };

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    setVerifyLoading(true);
    setErrorMessage('');
    await verifyToken(manualToken.trim());
    setVerifyLoading(false);
  };

  const handleResend = async () => {
    if (!emailParam) return;
    setResendLoading(true);
    setResendMessage('');
    try {
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailParam }),
      });
      if (response.ok) {
        setResendMessage('Link de verificação reenviado! Verifique sua caixa de entrada.');
      } else {
        setResendMessage('Erro ao reenviar. Tente novamente mais tarde.');
      }
    } catch {
      setResendMessage('Erro ao reenviar. Tente novamente mais tarde.');
    } finally {
      setResendLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      verifyToken(token);
    } else {
      // Sem token na URL — mostrar formulário para digitar
      setStatus('input');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Loading */}
          {status === 'loading' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4 animate-pulse">
                <svg
                  className="w-8 h-8 text-blue-600 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Verificando seu email...
              </h1>
              <p className="text-gray-600">
                Aguarde enquanto confirmamos sua conta
              </p>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="text-center">
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
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Email Verificado com Sucesso!
              </h1>
              <p className="text-gray-600 mb-6">
                Sua conta foi ativada e você já está logado.
              </p>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-800">
                  Você será redirecionado automaticamente para a área restrita em alguns segundos...
                </p>
              </div>

              <Link
                href="/area-restrita"
                className="inline-block bg-blue-600 text-surface-page py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Acessar Área Restrita Agora
              </Link>
            </div>
          )}

          {/* Input - formulário para digitar token */}
          {status === 'input' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Verificar Email
              </h1>
              <p className="text-gray-600 mb-6">
                Cole o token de verificação que você recebeu por email.
              </p>

              <form onSubmit={handleManualVerify} className="space-y-4">
                <input
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Cole o token aqui"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  disabled={verifyLoading}
                />
                {errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">{errorMessage}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={verifyLoading || !manualToken.trim()}
                  className="w-full bg-blue-600 text-surface-page py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-border-strong disabled:cursor-not-allowed"
                >
                  {verifyLoading ? 'Verificando...' : 'Verificar'}
                </button>
              </form>

              {emailParam && (
                <div className="mt-6">
                  <button
                    onClick={handleResend}
                    disabled={resendLoading}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm underline disabled:text-gray-400 disabled:no-underline"
                  >
                    {resendLoading ? 'Reenviando...' : 'Reenviar link de verificação'}
                  </button>
                  {resendMessage && (
                    <p className={`mt-2 text-sm ${resendMessage.includes('reenviado') ? 'text-green-600' : 'text-amber-accent-deep'}`}>
                      {resendMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
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
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Erro na Verificação
              </h1>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800">
                  {errorMessage}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">
                  Possíveis causas:
                </p>
                <ul className="text-sm text-gray-600 space-y-2 mb-6 text-left">
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    <span>O link de verificação expirou (válido por 24 horas)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    <span>O link já foi utilizado anteriormente</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    <span>O link está incompleto ou incorreto</span>
                  </li>
                </ul>

                <div className="space-y-3">
                  <Link
                    href="/login"
                    className="block w-full bg-blue-600 text-surface-page py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Tentar Fazer Login
                  </Link>
                  <Link
                    href="/contato"
                    className="block w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Entrar em Contato
                  </Link>
                </div>
              </div>
            </div>
          )}
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
