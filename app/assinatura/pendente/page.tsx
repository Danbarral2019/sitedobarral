import Link from 'next/link';

export default function AssinaturaPendentePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-lg p-10 border border-gray-100">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
            <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Pagamento Pendente
          </h1>
          <p className="text-gray-600 mb-6">
            Seu pagamento está sendo processado. Assim que for confirmado, seu acesso será liberado automaticamente.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 text-left">
            <p className="text-sm font-medium text-yellow-800 mb-2">Instruções:</p>
            <ul className="text-sm text-yellow-700 space-y-1.5">
              <li>- <strong>PIX:</strong> Escaneie o QR Code ou copie o código para finalizar o pagamento</li>
              <li>- <strong>Boleto:</strong> Pague até a data de vencimento indicada</li>
            </ul>
            <p className="text-xs text-yellow-600 mt-3">
              O processamento pode levar alguns minutos após a confirmação do pagamento.
            </p>
          </div>

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
