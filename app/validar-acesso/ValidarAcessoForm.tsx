'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { QrCode, Loader2, CheckCircle, XCircle, KeyRound } from 'lucide-react';

interface ValidarAcessoFormProps {
  initialError?: string;
}

export default function ValidarAcessoForm({ initialError = '' }: ValidarAcessoFormProps) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
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
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Código inválido');
      }

      setSuccess(true);

      // Redireciona para registro ou login
      if (data.needsRegistration) {
        router.push(`/registro?qr=${encodeURIComponent(data.qrCode)}&curso=${data.courseId}`);
      } else {
        router.push(`/login?curso=${data.courseId}&message=account-exists`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao validar código');
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-[6px] p-8 border-2 border-border-subtle">
            {/* Link para quem já tem conta */}
            <div className="mb-6 bg-brand-50 border-2 border-brand-200 rounded-[6px] p-4">
              <p className="text-center text-brand-900 font-medium">
                Já possui uma conta?{' '}
                <Link href="/login" className="text-brand-600 hover:text-brand-700 font-bold underline">
                  Clique aqui para fazer login
                </Link>
              </p>
            </div>

            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-brand-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-border-subtle">
                <KeyRound className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold mb-2 text-ink-primary">Primeiro Acesso</h1>
              <p className="text-ink-secondary">
                Insira o código do QR Code recebido no curso presencial
              </p>
            </div>

            {success ? (
              <div className="bg-green-50 border-2 border-green-500 rounded-[6px] p-6 text-center">
                <div className="w-16 h-16 bg-green-700 rounded-full flex items-center justify-center mx-auto mb-4 border border-border-subtle">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-ink-primary mb-2">QR Code Validado!</h3>
                <p className="text-ink-secondary font-medium">Redirecionando...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="code" className="block text-sm font-semibold text-ink-primary mb-2">
                    Código de Acesso
                  </label>
                  <div className="relative">
                    <QrCode className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-muted" />
                    <input
                      type="text"
                      id="code"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setError(''); // Limpa erro ao digitar
                      }}
                      placeholder="Digite o código..."
                      className="w-full pl-10 pr-4 py-3 border-2 border-border-subtle rounded-[6px] focus:ring-2 focus:ring-brand-500 focus:border-brand-600 text-ink-primary font-mono"
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border-2 border-red-500 rounded-[6px] p-4 flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800 font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !code.trim()}
                  className="w-full bg-brand-600 text-white px-6 py-4 rounded-[6px] text-lg font-bold hover:from-brand-700 hover:to-brand-700 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 hover: border border-border-subtle"
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

            <div className="mt-8 pt-6 border-t border-border-subtle">
              <h3 className="text-sm font-bold text-ink-primary mb-2">Como funciona?</h3>
              <ul className="text-sm text-ink-secondary space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-brand-600 font-bold">1.</span>
                  <span>Escaneie o QR Code fornecido no curso presencial</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-600 font-bold">2.</span>
                  <span>Ou insira manualmente o código de acesso</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-600 font-bold">3.</span>
                  <span>Tenha acesso aos materiais completos do curso</span>
                </li>
              </ul>
            </div>
          </div>

          <p className="text-center text-ink-muted mt-6 text-sm">
            Não recebeu o código?{' '}
            <a href="/contato" className="text-brand-600 hover:text-brand-700 font-semibold">
              Entre em contato
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
