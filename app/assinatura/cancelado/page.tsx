import Link from 'next/link';

export default function AssinaturaCanceladoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-lg p-10 border border-gray-100">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
            <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Pagamento Não Concluído
          </h1>
          <p className="text-gray-600 mb-8">
            O processo de pagamento foi cancelado. Nenhuma cobrança foi realizada.
          </p>

          <div className="space-y-3">
            <Link
              href="/planos"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Voltar aos Planos
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
