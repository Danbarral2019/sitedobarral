'use client';

import Link from 'next/link';

export default function AssinaturaSucessoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-lg p-10 border border-gray-100">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Assinatura Ativada!
          </h1>
          <p className="text-gray-600 mb-8">
            Seu pagamento foi processado com sucesso. Você já tem acesso aos materiais do curso.
          </p>

          <div className="space-y-3">
            <Link
              href="/area-restrita"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Ir para Área Restrita
            </Link>
            <Link
              href="/"
              className="block w-full text-gray-600 hover:text-gray-900 font-medium py-2 transition-colors"
            >
              Voltar ao site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
