'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

export default function ConfirmacaoRegistroPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const handleResendEmail = async () => {
    if (!email) return;

    setResendLoading(true);
    setResendMessage('');

    try {
      // TODO: Implementar endpoint de reenvio de email de verificação
      // const response = await fetch('/api/auth/resend-verification', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email }),
      // });

      // if (response.ok) {
      //   setResendMessage('Email reenviado com sucesso! Verifique sua caixa de entrada.');
      // } else {
      //   setResendMessage('Erro ao reenviar email. Tente novamente mais tarde.');
      // }

      // Simulação temporária
      setTimeout(() => {
        setResendMessage('Funcionalidade de reenvio será implementada em breve. Entre em contato com o professor se não receber o email.');
        setResendLoading(false);
      }, 1000);
    } catch (error) {
      setResendMessage('Erro ao reenviar email. Tente novamente mais tarde.');
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Conta Criada com Sucesso!
            </h1>
            <p className="text-gray-600">
              Falta só mais um passo para acessar os materiais do curso
            </p>
          </div>

          {/* Instruções */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">
              📧 Verifique seu email
            </h2>
            <div className="space-y-3 text-sm text-blue-800">
              <p>
                Enviamos um email de verificação para:{' '}
                <strong className="font-semibold">{email || 'seu email'}</strong>
              </p>
              <p>
                Para ativar sua conta e acessar os materiais do curso, clique no link de verificação que está no email.
              </p>
              <p className="text-blue-700">
                <strong>Dica:</strong> Se não encontrar o email, verifique sua pasta de spam ou lixo eletrônico.
              </p>
            </div>
          </div>

          {/* Tempo de validade */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <h3 className="text-sm font-semibold text-yellow-900 mb-2">
              ⏰ Link válido por 24 horas
            </h3>
            <p className="text-sm text-yellow-800">
              O link de verificação expira em 24 horas. Após esse período, será necessário solicitar um novo link.
            </p>
          </div>

          {/* Botão de reenviar */}
          <div className="text-center mb-8">
            <p className="text-sm text-gray-600 mb-3">
              Não recebeu o email?
            </p>
            <button
              onClick={handleResendEmail}
              disabled={resendLoading}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm underline disabled:text-gray-400 disabled:no-underline"
            >
              {resendLoading ? 'Reenviando...' : 'Clique aqui para reenviar'}
            </button>
            {resendMessage && (
              <p className={`mt-3 text-sm ${resendMessage.includes('sucesso') ? 'text-green-600' : 'text-yellow-600'}`}>
                {resendMessage}
              </p>
            )}
          </div>

          {/* Próximos passos */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Próximos passos:
            </h3>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full font-semibold text-xs mr-3 mt-0.5">
                  1
                </span>
                <span>Abra o email que enviamos para <strong>{email || 'você'}</strong></span>
              </li>
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full font-semibold text-xs mr-3 mt-0.5">
                  2
                </span>
                <span>Clique no link de verificação dentro do email</span>
              </li>
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full font-semibold text-xs mr-3 mt-0.5">
                  3
                </span>
                <span>Você será redirecionado automaticamente e poderá acessar todos os materiais do curso</span>
              </li>
            </ol>
          </div>

          {/* Link para voltar */}
          <div className="mt-8 text-center border-t border-gray-200 pt-6">
            <Link
              href="/"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Voltar para o site
            </Link>
          </div>
        </div>

        {/* Suporte */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Problemas com o cadastro?{' '}
            <Link href="/contato" className="text-blue-600 hover:text-blue-700 font-medium">
              Entre em contato conosco
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
