'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QrCode, Loader2, CheckCircle, XCircle, KeyRound } from 'lucide-react';

export default function ValidarAcessoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleValidation = useCallback(async (codeToValidate?: string) => {
    const finalCode = codeToValidate || code;

    if (!finalCode) {
      setError('Por favor, insira o código de acesso');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/validate-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: finalCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Código inválido');
      }

      setSuccess(true);

      // Se precisa fazer registro, redireciona para página de registro
      if (data.needsRegistration) {
        setTimeout(() => {
          router.push(`/registro?qr=${encodeURIComponent(data.qrCode)}&curso=${data.courseId}`);
        }, 1000);
      } else {
        // Já tem conta, redireciona para login
        setTimeout(() => {
          router.push(`/login?curso=${data.courseId}&message=account-exists`);
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao validar código');
    } finally {
      setIsLoading(false);
    }
  }, [code, router]);

  useEffect(() => {
    // Se veio com código na URL, valida automaticamente
    const urlCode = searchParams.get('code');
    if (urlCode) {
      setCode(urlCode);
      handleValidation(urlCode);
    }

    // Verifica se veio com erro de token expirado
    const errorParam = searchParams.get('error');
    if (errorParam === 'expired') {
      setError('Sua sessão expirou. Por favor, valide novamente seu código.');
    }
  }, [searchParams, handleValidation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleValidation();
  };

  return (
    <main className="min-h-screen py-12 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-gray-200">
            {/* Link para quem já tem conta */}
            <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <p className="text-center text-blue-900 font-medium">
                Já possui uma conta?{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-bold underline">
                  Clique aqui para fazer login
                </Link>
              </p>
            </div>

            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <KeyRound className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold mb-2 text-gray-900">Primeiro Acesso</h1>
              <p className="text-gray-700">
                Insira o código do QR Code recebido no curso presencial
              </p>
            </div>

            {success ? (
              <div className="bg-gradient-to-r from-green-50 to-teal-100 border-2 border-green-500 rounded-xl p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">QR Code Validado!</h3>
                <p className="text-gray-800 font-medium">Redirecionando...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="code" className="block text-sm font-semibold text-gray-900 mb-2">
                    Código de Acesso
                  </label>
                  <div className="relative">
                    <QrCode className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Digite o código..."
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 font-mono"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-gradient-to-r from-red-50 to-rose-100 border-2 border-red-500 rounded-xl p-4 flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800 font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !code}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-xl text-lg font-bold hover:from-blue-700 hover:to-purple-700 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-lg hover:shadow-2xl"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-5 h-5" />
                      Validar Código
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Como funciona?</h3>
              <ul className="text-sm text-gray-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">1.</span>
                  <span>Escaneie o QR Code fornecido no curso presencial</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">2.</span>
                  <span>Ou insira manualmente o código de acesso</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">3.</span>
                  <span>Tenha acesso aos materiais completos do curso</span>
                </li>
              </ul>
            </div>
          </div>

          <p className="text-center text-gray-600 mt-6 text-sm">
            Não recebeu o código?{' '}
            <a href="/contato" className="text-blue-600 hover:text-blue-700 font-semibold">
              Entre em contato
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
